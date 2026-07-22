/**
 * Vault 库管理服务 — 扫描、树维护、最近库记录
 *
 * 职责：
 * - open(path)：全量递归扫描，生成 FileTreeNode 树
 * - getTree()：返回缓存树
 * - patchTree(event)：根据文件变更事件局部更新缓存
 * - getRecent()/addRecent()：最近库列表
 */

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { KB_DIR, SIDECAR_SUFFIX, RECENT_VAULTS_FILENAME, RECENT_VAULTS_MAX } from '../../shared/constants'
import { FileTreeNode, VaultSummary, VaultChangeEvent, BoundNoteInfo, RecentVaultEntry } from '../../shared/types'

/** 扫描时忽略的目录/文件 */
const SCAN_IGNORE = new Set([KB_DIR, '.git', '.DS_Store'])
/** 支持的后缀 */
const NOTE_EXT = '.md'
const PDF_EXT = '.pdf'

export class VaultService {
  private vaultRoot = ''
  private tree: FileTreeNode[] = []

  // ── 库打开 / 扫描 ───────────────────────────────

  /** 打开库并扫描文件树 */
  open(vaultRootPath: string): VaultSummary {
    this.vaultRoot = path.resolve(vaultRootPath)

    // 确保 .kb 目录存在
    const kbDir = path.join(this.vaultRoot, KB_DIR)
    fs.mkdirSync(kbDir, { recursive: true })

    // 全量扫描
    this.tree = this.scanDir(this.vaultRoot, '')

    const stats = this.countNodes(this.tree)

    // 记录最近库
    this.addRecent(vaultRootPath)

    return {
      rootPath: this.vaultRoot,
      tree: this.tree,
      stats
    }
  }

  getVaultRoot(): string {
    return this.vaultRoot
  }

  getTree(): FileTreeNode[] {
    return this.tree
  }

  // ── 递归扫描（P-02 尽力注绑定子节点，失败则以无绑定树返回）──

  private scanDir(absDir: string, relParent: string): FileTreeNode[] {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true })
    } catch {
      return []
    }

    const nodes: FileTreeNode[] = []

    for (const ent of entries) {
      const name = ent.name

      // 忽略隐藏文件、.kb、临时文件
      if (name.startsWith('.') || SCAN_IGNORE.has(name) || name.endsWith('.tmp')) {
        continue
      }

      const relPath = relParent ? path.posix.join(relParent, name) : name
      const absPath = path.join(absDir, name)

      if (ent.isDirectory()) {
        const children = this.scanDir(absPath, relPath)
        nodes.push({
          path: relPath,
          name,
          kind: 'folder',
          children
        })
      } else if (ent.isFile()) {
        if (name.endsWith(NOTE_EXT)) {
          nodes.push({
            path: relPath,
            name,
            kind: 'note'
          })
        } else if (name.endsWith(PDF_EXT)) {
          // 尝试读取 sidecar 获取绑定笔记
          const boundNotes = this.readSidecarBindings(relPath)
          nodes.push({
            path: relPath,
            name,
            kind: 'pdf',
            boundNotes: boundNotes.length > 0 ? boundNotes : undefined
          })
        }
        // 其他文件类型忽略
      }
    }

    // 按文件夹优先、名称字母序排列
    return this.sortTree(nodes)
  }

  // ── sidecar 绑定笔记注入（P-02 尽力，P-03 完善校验） ──

  /**
   * 从 sidecar 读取 PDF 的绑定笔记列表
   *
   * P-02 期间：直接读 JSON 取 boundNotes，失败返回空
   * P-03 MetadataService 上线后用其替换此实现
   */
  private readSidecarBindings(pdfRelPath: string): BoundNoteInfo[] {
    const metaRelPath = pdfRelPath + SIDECAR_SUFFIX
    const metaAbs = path.join(this.vaultRoot, metaRelPath)

    try {
      const raw = fs.readFileSync(metaAbs, 'utf-8')
      const meta = JSON.parse(raw) as { boundNotes?: string[]; annotations?: unknown[] }
      const paths: string[] = meta.boundNotes ?? []

      return paths.map((noteRel) => {
        const noteAbs = path.join(this.vaultRoot, noteRel)
        const missing = !fs.existsSync(noteAbs)

        let title = path.basename(noteRel, NOTE_EXT)
        if (!missing) {
          try {
            const content = fs.readFileSync(noteAbs, 'utf-8')
            const h1 = content.match(/^#\s+(.+)/m)
            if (h1) title = h1[1].trim()
          } catch {
            // 读不到就用文件名
          }
        }

        return { notePath: noteRel, title, missing }
      })
    } catch {
      return []
    }
  }

  // ── 局部刷新（Watcher 回调） ────────────────────

  /**
   * 根据文件变更事件就地更新缓存树
   *
   * @returns 是否需要推送全量刷新（结构级变化）
   */
  patchTree(
    event: VaultChangeEvent
  ): 'patched' | 'full-refresh' {
    const relPath = event.relPath
    const absPath = path.join(this.vaultRoot, relPath)

    switch (event.type) {
      case 'add':
      case 'addDir': {
        if (fs.existsSync(absPath)) {
          const stat = fs.statSync(absPath)
          if (stat.isDirectory()) {
            // 新增目录 → 全量刷新
            return 'full-refresh'
          }
          // 新增文件 → 追加到树
          const parentDir = path.posix.dirname(relPath)
          const name = path.basename(relPath)
          const parentNode = this.findNodeByPath(this.tree, parentDir)
          if (parentNode && parentNode.children) {
            parentNode.children.push(this.createFileNode(name, relPath))
            this.sortTree(parentNode.children)
          } else {
            return 'full-refresh'
          }
        }
        break
      }

      case 'unlink': {
        const parentDir = path.posix.dirname(relPath)
        const name = path.basename(relPath)
        const parentNode = this.findNodeByPath(this.tree, parentDir)
        if (parentNode && parentNode.children) {
          parentNode.children = parentNode.children.filter((c) => c.name !== name)
        } else {
          return 'full-refresh'
        }
        break
      }

      case 'unlinkDir':
      case 'rename':
        // 目录级变化 → 全量刷新
        return 'full-refresh'

      case 'change': {
        // .md 内容变更 → 无需改树
        break
      }

      default:
        return 'full-refresh'
    }

    return 'patched'
  }

  refreshTree(): void {
    this.tree = this.scanDir(this.vaultRoot, '')
  }

  // ── 最近库 ───────────────────────────────────────

  getRecent(): RecentVaultEntry[] {
    try {
      const dir = app.getPath('userData')
      const filePath = path.join(dir, RECENT_VAULTS_FILENAME)
      if (!fs.existsSync(filePath)) return []
      const raw = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(raw) as RecentVaultEntry[]
    } catch {
      // vitest 环境中 app.getPath 不可用
      return []
    }
  }

  addRecent(vaultPath: string): void {
    const entries = this.getRecent()
    // 去重
    const filtered = entries.filter((e) => e.path !== vaultPath)
    filtered.unshift({ path: vaultPath, openedAt: new Date().toISOString() })

    // 截断
    const trimmed = filtered.slice(0, RECENT_VAULTS_MAX)

    try {
      const dir = app.getPath('userData')
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, RECENT_VAULTS_FILENAME), JSON.stringify(trimmed, null, 2))
    } catch {
      // vitest 环境中 app.getPath 不可用，静默降级
    }
  }

  // ── 辅助 ─────────────────────────────────────────

  private createFileNode(name: string, relPath: string): FileTreeNode {
    if (name.endsWith(NOTE_EXT)) {
      return { path: relPath, name, kind: 'note' }
    }
    if (name.endsWith(PDF_EXT)) {
      const boundNotes = this.readSidecarBindings(relPath)
      return {
        path: relPath,
        name,
        kind: 'pdf',
        boundNotes: boundNotes.length > 0 ? boundNotes : undefined
      }
    }
    return { path: relPath, name, kind: 'note' }
  }

  private findNodeByPath(
    nodes: FileTreeNode[],
    target: string
  ): FileTreeNode | null {
    if (target === '.' || target === '') {
      return { path: '', name: '', kind: 'folder', children: nodes }
    }
    for (const node of nodes) {
      if (node.path === target) return node
      if (node.children) {
        const found = this.findNodeByPath(node.children, target)
        if (found) return found
      }
    }
    return null
  }

  private sortTree(nodes: FileTreeNode[]): FileTreeNode[] {
    return nodes.sort((a, b) => {
      if (a.kind !== b.kind) {
        const order = { folder: 0, pdf: 1, note: 2 }
        return (order[a.kind] ?? 9) - (order[b.kind] ?? 9)
      }
      return a.name.localeCompare(b.name)
    })
  }

  private countNodes(nodes: FileTreeNode[]): VaultSummary['stats'] {
    let noteCount = 0
    let pdfCount = 0
    let folderCount = 0

    const walk = (list: FileTreeNode[]) => {
      for (const n of list) {
        if (n.kind === 'folder') folderCount++
        else if (n.kind === 'note') noteCount++
        else if (n.kind === 'pdf') pdfCount++
        if (n.children) walk(n.children)
      }
    }
    walk(nodes)
    return { noteCount, pdfCount, folderCount }
  }
}
