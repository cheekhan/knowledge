/**
 * VaultService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { VaultService } from '../VaultService'
import type { FileTreeNode } from '../../../shared/types'
import { KB_DIR } from '../../../shared/constants'

describe('VaultService', () => {
  let vaultService: VaultService
  let vaultRoot: string

  beforeEach(() => {
    vaultService = new VaultService()
    vaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-test-vault-'))
    vaultRoot = fs.realpathSync(vaultRoot)
  })

  afterEach(() => {
    if (fs.existsSync(vaultRoot)) {
      fs.rmSync(vaultRoot, { recursive: true, force: true })
    }
  })

  // ── 基本扫描 ─────────────────────────────────

  describe('open / getTree', () => {
    it('空目录返回空树', () => {
      const summary = vaultService.open(vaultRoot)
      expect(summary.tree).toEqual([])
      expect(summary.stats.noteCount).toBe(0)
    })

    it('扫描目录和笔记文件', () => {
      fs.mkdirSync(path.join(vaultRoot, 'notes'))
      fs.writeFileSync(path.join(vaultRoot, 'notes', 'a.md'), '# A')
      fs.writeFileSync(path.join(vaultRoot, 'notes', 'b.md'), '# B')

      const summary = vaultService.open(vaultRoot)
      expect(summary.stats.noteCount).toBe(2)
      expect(summary.stats.folderCount).toBe(1)
    })

    it('扫描 PDF 文件', () => {
      fs.mkdirSync(path.join(vaultRoot, 'pdfs'))
      fs.writeFileSync(path.join(vaultRoot, 'pdfs', 'book.pdf'), '%PDF-fake')

      const summary = vaultService.open(vaultRoot)
      expect(summary.stats.pdfCount).toBe(1)
    })

    it('树结构与磁盘一致', () => {
      fs.mkdirSync(path.join(vaultRoot, 'notes'), { recursive: true })
      fs.writeFileSync(path.join(vaultRoot, 'readme.md'), '# top')

      const tree = vaultService.open(vaultRoot).tree

      // readme.md 应为 note 类型
      const readme = tree.find((n) => n.name === 'readme.md')
      expect(readme).toBeDefined()
      expect(readme!.kind).toBe('note')

      // notes 目录
      const notesDir = tree.find((n) => n.name === 'notes')
      expect(notesDir).toBeDefined()
      expect(notesDir!.kind).toBe('folder')
    })

    it('忽略 .kb 目录', () => {
      fs.mkdirSync(path.join(vaultRoot, 'notes'), { recursive: true })
      fs.mkdirSync(path.join(vaultRoot, KB_DIR))
      fs.writeFileSync(path.join(vaultRoot, 'notes', 'a.md'), '# A')

      const tree = vaultService.open(vaultRoot).tree
      const kbNode = tree.find((n) => n.name === KB_DIR)
      expect(kbNode).toBeUndefined()
    })

    it('忽略隐藏文件与 .tmp', () => {
      fs.writeFileSync(path.join(vaultRoot, '.hidden'), 'x')
      fs.writeFileSync(path.join(vaultRoot, 'draft.tmp'), 'y')
      fs.writeFileSync(path.join(vaultRoot, 'normal.md'), '# ok')

      const summary = vaultService.open(vaultRoot)
      expect(summary.stats.noteCount).toBe(1)
      const names = summary.tree.map((n) => n.name)
      expect(names).not.toContain('.hidden')
      expect(names).not.toContain('draft.tmp')
    })
  })

  // ── sidecar 绑定笔记注入 ─────────────────────

  describe('sidecar 绑定笔记注入', () => {
    /** 从树中递归查找指定 kind 的节点 */
    const findNode = (nodes: FileTreeNode[], kind: string): FileTreeNode | undefined => {
      for (const n of nodes) {
        if (n.kind === kind) return n
        if (n.children) {
          const found = findNode(n.children, kind)
          if (found) return found
        }
      }
      return undefined
    }

    it('有 sidecar 时 PDF 节点含 boundNotes', () => {
      fs.mkdirSync(path.join(vaultRoot, 'pdfs'))
      fs.writeFileSync(path.join(vaultRoot, 'pdfs', 'book.pdf'), '%PDF')

      // 创建绑定笔记
      fs.mkdirSync(path.join(vaultRoot, 'notes'))
      fs.writeFileSync(path.join(vaultRoot, 'notes', 'book-笔记.md'), '# 读书笔记')

      // 创建 sidecar
      fs.writeFileSync(
        path.join(vaultRoot, 'pdfs', 'book.pdf.meta.json'),
        JSON.stringify({
          version: 2,
          file: 'book.pdf',
          tags: [],
          lastPage: 0,
          boundNotes: ['notes/book-笔记.md'],
          annotations: [],
          updatedAt: new Date().toISOString()
        })
      )

      const tree = vaultService.open(vaultRoot).tree
      const pdfNode = findNode(tree, 'pdf')
      expect(pdfNode).toBeDefined()
      expect(pdfNode!.boundNotes).toBeDefined()
      expect(pdfNode!.boundNotes!.length).toBe(1)
      expect(pdfNode!.boundNotes![0].notePath).toBe('notes/book-笔记.md')
      expect(pdfNode!.boundNotes![0].title).toBe('读书笔记')
    })

    it('无 sidecar 时 boundNotes 为 undefined', () => {
      fs.mkdirSync(path.join(vaultRoot, 'pdfs'))
      fs.writeFileSync(path.join(vaultRoot, 'pdfs', 'book.pdf'), '%PDF')

      const tree = vaultService.open(vaultRoot).tree
      const pdfNode = findNode(tree, 'pdf')
      expect(pdfNode).toBeDefined()
      expect(pdfNode!.boundNotes).toBeUndefined()
    })

    it('绑定笔记文件缺失时 missing=true', () => {
      fs.mkdirSync(path.join(vaultRoot, 'pdfs'))
      fs.writeFileSync(path.join(vaultRoot, 'pdfs', 'book.pdf'), '%PDF')

      fs.writeFileSync(
        path.join(vaultRoot, 'pdfs', 'book.pdf.meta.json'),
        JSON.stringify({
          version: 2,
          file: 'book.pdf',
          tags: [],
          lastPage: 0,
          boundNotes: ['notes/ghost.md'],
          annotations: [],
          updatedAt: new Date().toISOString()
        })
      )

      const tree = vaultService.open(vaultRoot).tree
      const pdfNode = findNode(tree, 'pdf')
      expect(pdfNode!.boundNotes![0].missing).toBe(true)
    })

    it('损坏的 sidecar 不导致扫描失败', () => {
      fs.mkdirSync(path.join(vaultRoot, 'pdfs'))
      fs.writeFileSync(path.join(vaultRoot, 'pdfs', 'book.pdf'), '%PDF')
      fs.writeFileSync(path.join(vaultRoot, 'pdfs', 'book.pdf.meta.json'), 'not-json{')

      // 不应抛错
      expect(() => vaultService.open(vaultRoot)).not.toThrow()
    })
  })

  // ── 局部刷新 patchTree ───────────────────────

  describe('patchTree / refreshTree', () => {
    it('新增 md 注入树', () => {
      fs.mkdirSync(path.join(vaultRoot, 'notes'))
      vaultService.open(vaultRoot)

      // 模拟外部新增文件
      fs.writeFileSync(path.join(vaultRoot, 'notes', 'new.md'), '# new')

      const result = vaultService.patchTree({ type: 'add', relPath: 'notes/new.md' })
      expect(result).toBe('patched')

      const tree = vaultService.getTree()
      const notes = tree.find((n) => n.name === 'notes')
      expect(notes!.children!.some((c) => c.name === 'new.md')).toBe(true)
    })

    it('删除文件从树移除', () => {
      fs.mkdirSync(path.join(vaultRoot, 'notes'))
      fs.writeFileSync(path.join(vaultRoot, 'notes', 'to-delete.md'), '# bye')
      vaultService.open(vaultRoot)

      fs.unlinkSync(path.join(vaultRoot, 'notes', 'to-delete.md'))
      vaultService.patchTree({ type: 'unlink', relPath: 'notes/to-delete.md' })

      const tree = vaultService.getTree()
      const notes = tree.find((n) => n.name === 'notes')
      expect(notes!.children!.some((c) => c.name === 'to-delete.md')).toBe(false)
    })

    it('新增目录触发全量刷新', () => {
      vaultService.open(vaultRoot)
      fs.mkdirSync(path.join(vaultRoot, 'new-dir'))
      const result = vaultService.patchTree({ type: 'addDir', relPath: 'new-dir' })
      expect(result).toBe('full-refresh')
    })

    it('refreshTree 重新扫描', () => {
      fs.mkdirSync(path.join(vaultRoot, 'notes'))
      fs.writeFileSync(path.join(vaultRoot, 'notes', 'a.md'), '# a')
      vaultService.open(vaultRoot)

      // 直接磁盘加文件，不走 patchTree
      fs.writeFileSync(path.join(vaultRoot, 'notes', 'b.md'), '# b')
      vaultService.refreshTree()

      const summary = {
        rootPath: vaultService.getVaultRoot(),
        tree: vaultService.getTree(),
        stats: { noteCount: 0, pdfCount: 0, folderCount: 0 }
      }
      // 验证刷新后包含新文件
      const notes = summary.tree.find((n) => n.name === 'notes')
      expect(notes!.children!.some((c) => c.name === 'b.md')).toBe(true)
    })
  })

  // ── 最近库 ───────────────────────────────────

  describe('getRecent / addRecent', () => {
    it('初始返回空列表', () => {
      const recent = vaultService.getRecent()
      expect(recent).toEqual([])
    })

    // 注：vitest 环境中 app.getPath 不可用，最近库持久化可能不生效
    // 该功能在 Electron 运行时由集成测试覆盖
  })
})
