/**
 * 全文索引服务 — better-sqlite3 + FTS5 trigram
 *
 * 职责：
 * - 创建/连接 index.db（DDL 含 notes/pdf/bindings 三表 + notes_fts）
 * - 增量索引：indexNote / removeNote / indexPdf
 * - 绑定冗余表：upsertBinding / removeBinding / clearBindingsOfPdf
 * - 搜索：query(str, opts) → SearchHit[]
 * - 全量重建：rebuild(onProgress)
 *
 * 红线 R7：bindings 表只是冗余加速，可被全量重建。
 */

import Database from 'better-sqlite3'
import * as path from 'path'
import * as fs from 'fs'
import { KB_DIR, DB_FILENAME, SIDECAR_SUFFIX } from '../../shared/constants'
import type { SearchHit, SearchOptions } from '../../shared/types'
import { extractText } from './PdfTextExtractor'

// ── SQL DDL ─────────────────────────────────────────

const CREATE_NOTES = `
CREATE TABLE IF NOT EXISTS notes (
  path TEXT PRIMARY KEY,
  title TEXT,
  mtime INTEGER
)`

const CREATE_NOTES_FTS = `
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  path UNINDEXED,
  title,
  content,
  tokenize='trigram'
)`

const CREATE_PDFS = `
CREATE TABLE IF NOT EXISTS pdfs (
  path TEXT PRIMARY KEY,
  name TEXT,
  tags TEXT,
  mtime INTEGER
)`

const CREATE_PDFS_FTS = `
CREATE VIRTUAL TABLE IF NOT EXISTS pdfs_fts USING fts5(
  path UNINDEXED,
  name,
  text_content,
  tokenize='trigram'
)`

const CREATE_BINDINGS = `
CREATE TABLE IF NOT EXISTS bindings (
  pdf_path TEXT,
  note_path TEXT,
  PRIMARY KEY (pdf_path, note_path)
)`

// ── 服务 ────────────────────────────────────────────

export class IndexService {
  private db: Database.Database | null = null
  private vaultRoot = ''

  // ── 生命周期 ─────────────────────────────────

  open(vaultRoot: string): void {
    this.vaultRoot = vaultRoot
    const kbDir = path.join(vaultRoot, KB_DIR)
    fs.mkdirSync(kbDir, { recursive: true })

    const dbPath = path.join(kbDir, DB_FILENAME)
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')

    // 建表
    this.db.exec(CREATE_NOTES)
    this.db.exec(CREATE_NOTES_FTS)
    this.db.exec(CREATE_PDFS)
    this.db.exec(CREATE_PDFS_FTS)
    this.db.exec(CREATE_BINDINGS)
  }

  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }

  private requireDb(): Database.Database {
    if (!this.db) throw new Error('IndexService 未 open')
    return this.db
  }

  // ── 笔记索引 ─────────────────────────────────

  /** 索引或更新单篇笔记 */
  indexNote(relPath: string): void {
    const db = this.requireDb()
    const absPath = path.join(this.vaultRoot, relPath)

    let content = ''
    try {
      content = fs.readFileSync(absPath, 'utf-8')
    } catch {
      // 读不到就跳过
      return
    }

    const title = extractTitle(content, relPath)
    const mtime = fs.statSync(absPath).mtimeMs

    // upsert notes
    db.prepare(
      'INSERT OR REPLACE INTO notes (path, title, mtime) VALUES (?, ?, ?)'
    ).run(relPath, title, mtime)

    // rebuild FTS entry
    db.prepare('DELETE FROM notes_fts WHERE path = ?').run(relPath)
    db.prepare(
      'INSERT INTO notes_fts (path, title, content) VALUES (?, ?, ?)'
    ).run(relPath, title, content)
  }

  /** 从索引中移除笔记 */
  removeNote(relPath: string): void {
    const db = this.requireDb()
    db.prepare('DELETE FROM notes WHERE path = ?').run(relPath)
    db.prepare('DELETE FROM notes_fts WHERE path = ?').run(relPath)
  }

  // ── PDF 元数据索引 ────────────────────────────

  /** 索引或更新 PDF 元数据 + 文本提取 */
  indexPdf(relPath: string): void {
    const db = this.requireDb()
    const absPath = path.join(this.vaultRoot, relPath)
    const metaPath = absPath + SIDECAR_SUFFIX

    const name = path.basename(relPath)
    let tags = '[]'
    let mtime = 0

    try {
      mtime = fs.statSync(absPath).mtimeMs
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
        tags = JSON.stringify(meta.tags ?? [])
      }
    } catch {
      // 读不到就跳过
    }

    db.prepare(
      'INSERT OR REPLACE INTO pdfs (path, name, tags, mtime) VALUES (?, ?, ?, ?)'
    ).run(relPath, name, tags, mtime)

    // P-13: 提取 PDF 文本索引入 pdfs_fts
    const text = extractText(this.vaultRoot, relPath)
    if (text) {
      db.prepare('DELETE FROM pdfs_fts WHERE path = ?').run(relPath)
      db.prepare(
        'INSERT INTO pdfs_fts (path, name, text_content) VALUES (?, ?, ?)'
      ).run(relPath, name, text)
    }
  }

  removePdf(relPath: string): void {
    const db = this.requireDb()
    db.prepare('DELETE FROM pdfs WHERE path = ?').run(relPath)
    db.prepare('DELETE FROM pdfs_fts WHERE path = ?').run(relPath)
    db.prepare('DELETE FROM bindings WHERE pdf_path = ?').run(relPath)
  }

  // ── 绑定冗余表（供 P-03 BindingService 调用） ──

  upsertBinding(pdfPath: string, notePath: string): void {
    const db = this.requireDb()
    db.prepare(
      'INSERT OR REPLACE INTO bindings (pdf_path, note_path) VALUES (?, ?)'
    ).run(pdfPath, notePath)
  }

  removeBinding(pdfPath: string, notePath: string): void {
    const db = this.requireDb()
    db.prepare(
      'DELETE FROM bindings WHERE pdf_path = ? AND note_path = ?'
    ).run(pdfPath, notePath)
  }

  clearBindingsOfPdf(pdfPath: string): void {
    const db = this.requireDb()
    db.prepare('DELETE FROM bindings WHERE pdf_path = ?').run(pdfPath)
  }

  /** 反查笔记绑定的 PDF（走 bindings 表 O(1)） */
  pdfOfNote(notePath: string): string | null {
    const db = this.requireDb()
    try {
      const row = db
        .prepare('SELECT pdf_path FROM bindings WHERE note_path = ?')
        .get(notePath) as { pdf_path: string } | undefined
      return row?.pdf_path ?? null
    } catch {
      return null
    }
  }

  // ── 搜索 ─────────────────────────────────────

  query(q: string, opts: SearchOptions = {}): SearchHit[] {
    const db = this.requireDb()
    const scope = opts.scope ?? 'all'
    const limit = opts.limit ?? 50
    const results: SearchHit[] = []

    // ── 笔记搜索 ──
    if (scope === 'all' || scope === 'notes') {
      try {
        // FTS5 trigram 直接 MATCH（子串匹配）
        const rows = db
          .prepare(
            `SELECT path, title,
                    snippet(notes_fts, 1, '<mark>', '</mark>', '...', 40) as snippet
             FROM notes_fts
             WHERE notes_fts MATCH ?
             ORDER BY rank
             LIMIT ?`
          )
          .all(q, limit) as { path: string; title: string; snippet: string }[]

        for (const row of rows) {
          results.push({
            title: row.title || path.basename(row.path, '.md'),
            path: row.path,
            kind: 'note',
            snippet: stripFtsMarkers(row.snippet)
          })
        }
      } catch {
        // MATCH 语法错误时静默返回空
      }
    }

    // ── PDF 搜索 ──
    if (scope === 'all' || scope === 'pdfs') {
      if (opts.tag) {
        // 按标签筛选
        const rows = db
          .prepare('SELECT path, name FROM pdfs WHERE tags LIKE ? LIMIT ?')
          .all(`%"${opts.tag}"%`, limit) as { path: string; name: string }[]
        for (const row of rows) {
          results.push({ title: path.basename(row.name, '.pdf'), path: row.path, kind: 'pdf' })
        }
      } else if (q.trim()) {
        // 优先 FTS 文本搜索，回退文件名 LIKE
        try {
          const ftsRows = db
            .prepare(
              'SELECT path, name, snippet(pdfs_fts, 1, \'<mark>\', \'</mark>\', \'...\', 40) as snippet FROM pdfs_fts WHERE pdfs_fts MATCH ? ORDER BY rank LIMIT ?'
            )
            .all(q, limit) as { path: string; name: string; snippet: string }[]
          for (const row of ftsRows) {
            results.push({
              title: path.basename(row.name, '.pdf'),
              path: row.path,
              kind: 'pdf',
              snippet: row.snippet
            })
          }
        } catch {
          // FTS 失败回退文件名 LIKE
        }
        // 如果 FTS 无结果，回退文件名搜索
        if (results.filter((r) => r.kind === 'pdf').length === 0) {
          const nameRows = db
            .prepare('SELECT path, name FROM pdfs WHERE name LIKE ? LIMIT ?')
            .all(`%${q}%`, limit) as { path: string; name: string }[]
          for (const row of nameRows) {
            results.push({ title: path.basename(row.name, '.pdf'), path: row.path, kind: 'pdf' })
          }
        }
      }
    }

    return results
  }

  // ── 全量重建 ─────────────────────────────────

  rebuild(onProgress?: (pct: number) => void): void {
    const db = this.requireDb()

    // 清空
    db.exec('DELETE FROM notes')
    db.exec('DELETE FROM notes_fts')
    db.exec('DELETE FROM pdfs')
    db.exec('DELETE FROM pdfs_fts')
    db.exec('DELETE FROM bindings')

    // 递归扫描
    const entries = this.collectFiles('')
    const total = entries.length

    if (total === 0) {
      onProgress?.(1)
      return
    }

    for (let i = 0; i < total; i++) {
      const entry = entries[i]
      if (entry.endsWith('.md')) {
        this.indexNote(entry)
      } else if (entry.endsWith('.pdf')) {
        this.indexPdf(entry)
        // 重建 bindings
        this.rebuildBindings(entry)
      }
      onProgress?.(i / total)
    }

    onProgress?.(1)
  }

  // ── 辅助 ──────────────────────────────────────────

  /** 收集库内所有 .md / .pdf 文件（忽略隐藏与 .kb） */
  private collectFiles(relDir: string): string[] {
    const absDir = relDir ? path.join(this.vaultRoot, relDir) : this.vaultRoot
    const result: string[] = []

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true })
    } catch {
      return result
    }

    for (const ent of entries) {
      const name = ent.name
      if (name.startsWith('.') || name === KB_DIR || name.endsWith('.tmp')) continue

      const relPath = relDir ? path.posix.join(relDir, name) : name

      if (ent.isDirectory()) {
        result.push(...this.collectFiles(relPath))
      } else if (ent.isFile()) {
        if (name.endsWith('.md') || name.endsWith('.pdf')) {
          result.push(relPath)
        }
      }
    }

    return result
  }

  /** 从 sidecar 重建一份 PDF 的 bindings */
  private rebuildBindings(pdfRelPath: string): void {
    const metaPath = path.join(this.vaultRoot, pdfRelPath + SIDECAR_SUFFIX)
    try {
      if (!fs.existsSync(metaPath)) return
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
      const boundNotes: string[] = meta.boundNotes ?? []
      for (const noteRel of boundNotes) {
        this.upsertBinding(pdfRelPath, noteRel)
      }
    } catch {
      // 损坏 sidecar 跳过
    }
  }
}

// ── 纯函数 ──────────────────────────────────────────

/** 从 Markdown 内容提取标题（首个 H1 → 文件名） */
function extractTitle(content: string, relPath: string): string {
  const h1 = content.match(/^#\s+(.+)/m)
  if (h1) return h1[1].trim()
  return path.basename(relPath, '.md')
}

/** 清除 FTS5 snippet 返回的不可见字符 */
function stripFtsMarkers(snippet: string): string {
  // eslint-disable-next-line no-control-regex
  return snippet.replace(/[\x00-\x1F\x7F]/g, '').trim()
}
