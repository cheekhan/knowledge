/**
 * 绑定关系服务 — boundNotes 维护、路径修复
 *
 * 红线 R7 落地：绑定关系唯一事实来源是 sidecar boundNotes 数组
 *
 * 核心能力：
 * - createBoundNote：创建绑定笔记 → 写 md + 写 sidecar
 * - unbind：从 boundNotes 移除路径
 * - listBoundNotes：列出绑定笔记（含 missing 标记 + 标题提取）
 * - pdfOfNote：反查笔记绑定的 PDF（优先走 IndexService 回调）
 * - repairOnRename：笔记/PDF 重命名后批量修复 sidecar 路径
 */

import * as fs from 'fs'
import * as path from 'path'
import { NOTES_DIR, SIDECAR_SUFFIX } from '../../shared/constants'
import { MetadataService } from './MetadataService'
import { FileSystemService } from './FileSystemService'
import type { BoundNoteInfo } from '../../shared/types'

/** IndexService 回调类型（P-04 注入） */
export type IndexBindingCallback = {
  upsertBinding: (pdfPath: string, notePath: string) => void
  removeBinding: (pdfPath: string, notePath: string) => void
  clearBindingsOfPdf: (pdfPath: string) => void
  pdfOfNote: (notePath: string) => string | null
}

const NOOP_CALLBACK: IndexBindingCallback = {
  upsertBinding: () => {},
  removeBinding: () => {},
  clearBindingsOfPdf: () => {},
  pdfOfNote: () => null
}

export class BindingService {
  private vaultRoot = ''
  private metadataService!: MetadataService
  private fsService!: FileSystemService
  private indexCb: IndexBindingCallback = NOOP_CALLBACK

  // ── 依赖注入 ─────────────────────────────────

  inject(
    vaultRoot: string,
    meta: MetadataService,
    fs: FileSystemService,
    cb?: IndexBindingCallback
  ): void {
    this.vaultRoot = vaultRoot
    this.metadataService = meta
    this.fsService = fs
    this.indexCb = cb ?? NOOP_CALLBACK
  }

  setIndexCallback(cb: IndexBindingCallback): void {
    this.indexCb = cb
  }

  setVaultRoot(root: string): void {
    this.vaultRoot = root
  }

  // ── 创建绑定笔记（核心） ────────────────────────

  /**
   * 创建绑定笔记 → 写 md + 写 sidecar → 返回新笔记路径
   *
   * @param pdfPath PDF 库内相对路径
   * @param opts.dir 自定义目标目录（默认 notes/<PDF文件名去扩展名>/）
   * @param opts.name 自定义文件名（默认 《PDF名》笔记 N.md，N 自动递增）
   */
  createBoundNote(
    pdfPath: string,
    opts?: { dir?: string; name?: string }
  ): string {
    const pdfName = path.basename(pdfPath, '.pdf')
    const pdfTitle = `《${pdfName}》`

    // 确定目标目录
    const targetDir = opts?.dir ?? `${NOTES_DIR}/${pdfName}`

    // 确定文件名
    let fileName: string
    if (opts?.name) {
      fileName = opts.name.endsWith('.md') ? opts.name : opts.name + '.md'
    } else {
      fileName = this.nextNoteName(pdfPath, pdfTitle, targetDir)
    }

    // 生成初始内容
    const sourceLine = `> 来源 PDF：${pdfPath}（文件级绑定，无需标记）`
    const initialContent = `# ${pdfTitle} 笔记\n\n${sourceLine}\n\n`

    // 创建 md 文件
    const noteRel = this.fsService.createNote(targetDir, fileName, initialContent)

    // 写入 sidecar boundNotes
    const meta = this.metadataService.read(pdfPath)
    meta.boundNotes.push(noteRel)
    this.metadataService.update(pdfPath, { boundNotes: meta.boundNotes })

    // 更新索引冗余
    this.indexCb.upsertBinding(pdfPath, noteRel)

    return noteRel
  }

  // ── 解绑 ─────────────────────────────────────────

  unbind(pdfPath: string, notePath: string): void {
    const meta = this.metadataService.read(pdfPath)
    meta.boundNotes = meta.boundNotes.filter((p) => p !== notePath)
    this.metadataService.update(pdfPath, { boundNotes: meta.boundNotes })

    this.indexCb.removeBinding(pdfPath, notePath)
  }

  // ── 查询 ─────────────────────────────────────────

  listBoundNotes(pdfPath: string): BoundNoteInfo[] {
    const meta = this.metadataService.read(pdfPath)

    return meta.boundNotes.map((noteRel) => {
      const noteAbs = path.join(this.vaultRoot, noteRel)
      const missing = !fs.existsSync(noteAbs)

      let title = path.basename(noteRel, '.md')
      if (!missing) {
        try {
          const content = fs.readFileSync(noteAbs, 'utf-8')
          const h1 = content.match(/^#\s+(.+)/m)
          if (h1) title = h1[1].trim()
        } catch {
          // 读不到用文件名
        }
      }

      return { notePath: noteRel, title, missing }
    })
  }

  pdfOfNote(notePath: string): string | null {
    // 优先走索引
    const fromIndex = this.indexCb.pdfOfNote(notePath)
    if (fromIndex) return fromIndex

    // 回退：全量扫 sidecar
    return this.pdfOfNoteFallback(notePath)
  }

  // ── 路径修复（FR-6.5） ──────────────────────────

  /**
   * 笔记/PDF 重命名后批量修复 sidecar boundNotes
   *
   * @param oldRel 旧路径
   * @param newRel 新路径
   * @returns 修复失败的文件清单
   */
  async repairOnRename(oldRel: string, newRel: string): Promise<RepairReport> {
    const failed: RepairFailure[] = []

    // 只在库内操作
    if (!this.vaultRoot) return { failed }

    // 扫描所有 sidecar
    const sidecars = this.findAllSidecars()
    for (const metaRel of sidecars) {
      try {
        const absPath = path.join(this.vaultRoot, metaRel)
        const raw = fs.readFileSync(absPath, 'utf-8')
        const meta = JSON.parse(raw) as { boundNotes?: string[] }

        if (!meta.boundNotes) continue

        let changed = false
        const updated = meta.boundNotes.map((n) => {
          if (n === oldRel) {
            changed = true
            return newRel
          }
          // 处理移动：前缀匹配（目录重命名）
          if (oldRel.endsWith('/') && n.startsWith(oldRel)) {
            changed = true
            return newRel + n.slice(oldRel.length)
          }
          return n
        })

        if (changed) {
          meta.boundNotes = updated
          // 原子写（复用 MetadataService 的逻辑但不调 update，避免递归）
          const tmpPath = absPath + '.tmp'
          fs.writeFileSync(tmpPath, JSON.stringify(meta, null, 2), 'utf-8')
          const fd = fs.openSync(tmpPath, 'r+')
          fs.fsyncSync(fd)
          fs.closeSync(fd)
          fs.renameSync(tmpPath, absPath)
        }
      } catch (e) {
        failed.push({
          sidecar: metaRel,
          error: String(e)
        })
      }
    }

    // 同步索引 bindings 表
    if (oldRel.endsWith('.md')) {
      this.indexCb.removeBinding('', oldRel)
      // 重新扫描所有 sidecar 重建该笔记的绑定
      this.rebuildBindingsForNote(newRel, oldRel)
    }

    return { failed }
  }

  // ── 内部 ──────────────────────────────────────────

  private findAllSidecars(): string[] {
    const result: string[] = []
    this.collectSidecars('', result)
    return result
  }

  private collectSidecars(relDir: string, result: string[]): void {
    const absDir = relDir
      ? path.join(this.vaultRoot, relDir)
      : this.vaultRoot

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true })
    } catch {
      return
    }

    for (const ent of entries) {
      if (ent.name.startsWith('.')) continue

      const relPath = relDir ? path.posix.join(relDir, ent.name) : ent.name

      if (ent.isDirectory()) {
        this.collectSidecars(relPath, result)
      } else if (ent.isFile() && ent.name.endsWith(SIDECAR_SUFFIX)) {
        result.push(relPath)
      }
    }
  }

  private nextNoteName(
    pdfPath: string,
    pdfTitle: string,
    targetDir: string
  ): string {
    const meta = this.metadataService.read(pdfPath)
    const existing = meta.boundNotes.length

    // 扫描 targetDir 下的 md 文件
    const dirAbs = path.join(this.vaultRoot, targetDir)
    const dirNotes: string[] = []
    try {
      if (fs.existsSync(dirAbs)) {
        const files = fs.readdirSync(dirAbs)
        dirNotes.push(
          ...files.filter((f) => f.startsWith(pdfTitle) && f.endsWith('.md'))
        )
      }
    } catch {
      // ignore
    }

    let n = existing + 1
    const candidate = () => `${pdfTitle} 笔记 ${n}.md`
    while (dirNotes.includes(candidate())) {
      n++
    }

    return candidate()
  }

  private pdfOfNoteFallback(notePath: string): string | null {
    const sidecars = this.findAllSidecars()
    for (const metaRel of sidecars) {
      try {
        const raw = fs.readFileSync(
          path.join(this.vaultRoot, metaRel),
          'utf-8'
        )
        const meta = JSON.parse(raw) as { boundNotes?: string[] }
        if (meta.boundNotes?.includes(notePath)) {
          // 去掉 .meta.json 后缀，得到 pdf 路径
          return metaRel.slice(0, -SIDECAR_SUFFIX.length)
        }
      } catch {
        // skip broken sidecar
      }
    }
    return null
  }

  private rebuildBindingsForNote(newRel: string, oldRel: string): void {
    // 找到引用该笔记的 PDF，重建 bindings 行
    const pdfPath = this.pdfOfNoteFallback(newRel)
    if (pdfPath) {
      this.indexCb.removeBinding(pdfPath, oldRel)
      this.indexCb.upsertBinding(pdfPath, newRel)
    }
  }
}

type RepairFailure = { sidecar: string; error: string }
interface RepairReport {
  failed: RepairFailure[]
}
