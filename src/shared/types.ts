/**
 * 领域类型定义 — 主进程与渲染进程共用
 *
 * 规则：
 * - 禁止 import Node API 或 DOM API
 * - 所有字段写 TSDoc
 * - 修改本文件视同契约变更（A.4 流程）
 */

// ============================================================
// 标注
// ============================================================

/** 归一化矩形（0~1 相对页面尺寸） */
export interface NormalizedRect {
  /** 左上角 X（0~1） */
  x: number
  /** 左上角 Y（0~1） */
  y: number
  /** 宽度（0~1） */
  w: number
  /** 高度（0~1） */
  h: number
}

/** 标注颜色（hex） */
export type AnnotationColor = string

/** 标注类型 */
export type AnnotationType = 'rect' | 'highlight'

/** 单条页内标注 */
export interface Annotation {
  /** 唯一 ID（crypto.randomUUID 生成） */
  id: string
  /** 所在页码（从 1 起） */
  page: number
  /** 标注类型 */
  type: AnnotationType
  /** 归一化矩形坐标 */
  rect: NormalizedRect
  /** 填充颜色 hex */
  color: AnnotationColor
  /** 备注文本 */
  comment: string
  /** 创建时间 ISO 8601 */
  createdAt: string
}

// ============================================================
// PDF sidecar 元数据
// ============================================================

/** PDF sidecar 完整元数据（xxx.pdf.meta.json） */
export interface PdfMeta {
  /** schema 版本号 */
  version: number
  /** PDF 文件名（仅展示用） */
  file: string
  /** 文件级标签 */
  tags: string[]
  /** 上次阅读页（从 1 起，0 = 未读过） */
  lastPage: number
  /** 绑定的笔记相对路径列表（一对多，库内相对路径） */
  boundNotes: string[]
  /** 页内标注列表 */
  annotations: Annotation[]
  /** 最后修改时间 ISO 8601 */
  updatedAt: string
}

/** 创建空元数据（用于无 sidecar 时的默认值） */
export function createDefaultMeta(fileName: string): PdfMeta {
  return {
    version: 2,
    file: fileName,
    tags: [],
    lastPage: 0,
    boundNotes: [],
    annotations: [],
    updatedAt: new Date().toISOString()
  }
}

// ============================================================
// 文件树
// ============================================================

/** 文件树节点 */
export interface FileTreeNode {
  /** 库内相对路径 */
  path: string
  /** 节点名（不含路径） */
  name: string
  /** 节点类型 */
  kind: 'folder' | 'note' | 'pdf'
  /** 绑定笔记信息（仅 kind='pdf' 且有绑定时存在） */
  boundNotes?: BoundNoteInfo[]
  /** 子节点（仅 kind='folder'） */
  children?: FileTreeNode[]
}

/** 绑定笔记信息 */
export interface BoundNoteInfo {
  /** 库内相对路径 */
  notePath: string
  /** 笔记标题（取自 md 首个 H1，无则取文件名） */
  title: string
  /** 文件是否在磁盘上存在（外部删除时标记 false） */
  missing: boolean
}

// ============================================================
// Vault（库）
// ============================================================

/** 库扫描摘要 */
export interface VaultSummary {
  /** Vault 根目录绝对路径 */
  rootPath: string
  /** 文件树（根节点为 Vault 根目录的 children） */
  tree: FileTreeNode[]
  /** 统计 */
  stats: {
    noteCount: number
    pdfCount: number
    folderCount: number
  }
}

/** 文件变更事件（主 → 渲染） */
export type VaultChangeEventType =
  | 'add'
  | 'change'
  | 'unlink'
  | 'addDir'
  | 'unlinkDir'
  | 'rename'
  | 'reindex'
  | 'full-refresh'

export interface VaultChangeEvent {
  type: VaultChangeEventType
  /** 受影响的相对路径 */
  relPath: string
  /** rename 时的旧路径 */
  oldPath?: string
  /** reindex 时的进度（0~1） */
  progress?: number
}

/** 最近打开的库条目 */
export interface RecentVaultEntry {
  /** Vault 根目录绝对路径 */
  path: string
  /** 最后打开时间 ISO 8601 */
  openedAt: string
}

// ============================================================
// 搜索
// ============================================================

/** 搜索范围 */
export type SearchScope = 'notes' | 'pdfs' | 'all'

/** 搜索选项 */
export interface SearchOptions {
  /** 搜索范围 */
  scope?: SearchScope
  /** 按标签筛选（仅 scope 含 pdfs 时生效） */
  tag?: string
  /** 最多返回条数 */
  limit?: number
}

/** 搜索命中的单条结果 */
export interface SearchHit {
  /** 标题（笔记 H1 / PDF 文件名） */
  title: string
  /** 库内相对路径 */
  path: string
  /** 所属类型 */
  kind: 'note' | 'pdf'
  /** 内容摘要片段（含高亮标记 `<mark>...</mark>`） */
  snippet?: string
  /** PDF 命中页码（仅当 kind='pdf' 且支持页内搜索时） */
  page?: number
}

// ============================================================
// 设置
// ============================================================

/** 应用设置（存 .kb/app.json） */
export interface AppSettings {
  /** 主题 */
  theme: 'system' | 'light' | 'dark'
  /** 编辑器字号 */
  editorFontSize: number
  /** 自动保存间隔（毫秒） */
  autoSaveIntervalMs: number
  /** 上次分屏布局（可空） */
  lastLayout?: {
    splitRatio: number
    pdfSide: 'left' | 'right'
  }
  /** 上次打开的 Vault 路径 */
  lastVaultPath?: string
  /** 上次分屏时打开的笔记路径 */
  lastNotePath?: string
  /** 上次分屏时打开的 PDF 路径 */
  lastPdfPath?: string
}

/** 应用设置默认值 */
export function createDefaultSettings(): AppSettings {
  return {
    theme: 'system',
    editorFontSize: 15,
    autoSaveIntervalMs: 1000
  }
}

// ============================================================
// 错误
// ============================================================

/**
 * IPC 错误对象（架构 4.9 错误码规范）
 *
 * code 前缀约定：
 * - E_PATH_*  路径安全/越权
 * - E_FS_*    文件系统操作
 * - E_META_*  sidecar 元数据
 * - E_BIND_*  绑定关系
 * - E_INDEX_* 索引
 */
export interface IpcError {
  /** 错误码（如 E_PATH_OUTSIDE_VAULT） */
  code: string
  /** 用户可读错误描述 */
  message: string
  /** 调试用详细信息（可选） */
  detail?: unknown
}

// ============================================================
// 自动更新
// ============================================================

/** 更新状态，主进程 → 渲染进程 */
export interface UpdateStatus {
  /** 当前阶段 */
  phase: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  /** 新版本号（available/downloading/downloaded 时有值） */
  version?: string
  /** 下载进度 0~100（downloading 时有值） */
  progress?: number
  /** 错误信息（error 时有值） */
  error?: string
}

// ============================================================
// 泛型
// ============================================================

/** IPC 取消订阅函数 */
export type Unsubscribe = () => void

/** 可取消 */
export interface Disposable {
  dispose(): void
}
