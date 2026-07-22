/**
 * 全局常量 — 主进程与渲染进程共用
 * P-01 冻结，后续包如需新增常量须在 P-01 的 constants.ts 追加
 */

// --------------- 目录与文件命名 ---------------

/** Vault 内软件专属目录名（存索引与配置） */
export const KB_DIR = '.kb'

/** 笔记默认目录名 */
export const NOTES_DIR = 'notes'

/** PDF 默认目录名 */
export const PDFS_DIR = 'pdfs'

/** 笔记引用的附件/图片默认目录名 */
export const ASSETS_DIR = 'assets'

/** PDF sidecar 元数据文件后缀 */
export const SIDECAR_SUFFIX = '.meta.json'

/** 当前 sidecar schema 版本号（v3：bookmarks 替代 tags） */
export const META_VERSION = 3

/** 原子写入时使用的临时文件后缀 */
export const TMP_SUFFIX = '.tmp'

/** 应用数据库文件名 */
export const DB_FILENAME = 'index.db'

/** Vault 内应用配置文件 */
export const APP_CONFIG_FILENAME = 'app.json'

/** 用户级最近库记录文件（存于 app.getPath('userData')） */
export const RECENT_VAULTS_FILENAME = 'recent-vaults.json'

// --------------- 事件通道名 ---------------

/** 主进程 → 渲染进程：Vault 内文件变更通知（VaultChangeEvent） */
export const EVENT_VAULT_CHANGED = 'vault:changed'

/** 主进程 → 渲染进程：某笔记被外部修改（编辑中时推送冲突） */
export const EVENT_NOTE_EXTERNALLY_MODIFIED = 'note:externally-modified'

// --------------- 默认值 ---------------

/** 分屏默认左比例 */
export const DEFAULT_SPLIT_RATIO = 0.5

/** 分屏比例最小/最大值 */
export const MIN_SPLIT_RATIO = 0.3
export const MAX_SPLIT_RATIO = 0.7

/** PDF 缩放范围 */
export const SCALE_MIN = 0.5
export const SCALE_MAX = 4.0

/** PDF 页面 canvas 缓存 LRU 上限（页数） */
export const PDF_CACHE_CAPACITY = 50

/** PDF 页面尺寸并发获取上限（避免打开大 PDF 时瞬间大量 IPC） */
export const PDF_DIM_FETCH_CONCURRENCY = 4

/** 虚拟化视口上下各多渲染的缓冲页数 */
export const PDF_VISIBLE_BUFFER = 2

/** 单页 canvas 像素上限（16 megapixels），超出自动降低 devicePixelRatio */
export const PDF_MAX_CANVAS_PIXELS = 16_000_000

/** 渲染缓存总像素预算（200 megapixels）：离屏副本总占用上限，超出淘汰最久未用页 */
export const PDF_MAX_CACHE_PIXELS = 200_000_000

/** PDF 页面并行渲染数：提升可见页呈现速度，同时避免抢占主线程 */
export const PDF_RENDER_CONCURRENCY = 3

/** 自动保存防抖毫秒 */
export const AUTO_SAVE_DEBOUNCE_MS = 1000

/** 最近库列表上限 */
export const RECENT_VAULTS_MAX = 10

/** PDF 标注色板 */
export const ANNOTATION_COLORS = [
  '#FFD54F', '#FF8A65', '#81C784',
  '#64B5F6', '#BA68C8', '#4DB6AC'
] as const

// --------------- IPC 通道名（namespace:action） ---------------

export const IPC_CHANNELS = {
  // vault
  VAULT_OPEN: 'vault:open',
  VAULT_GET_TREE: 'vault:getTree',
  VAULT_GET_RECENT: 'vault:getRecent',
  // note
  NOTE_READ: 'note:read',
  NOTE_WRITE: 'note:write',
  NOTE_CREATE: 'note:create',
  NOTE_RENAME: 'note:rename',
  NOTE_MOVE: 'note:move',
  NOTE_DELETE: 'note:delete',
  // pdf
  PDF_READ_BUFFER: 'pdf:readBuffer',
  PDF_GET_META: 'pdf:getMeta',
  PDF_UPDATE_META: 'pdf:updateMeta',
  // pdf:listByTag 已删除（O-02：tags → bookmarks）
  // binding
  BINDING_CREATE: 'binding:createBoundNote',
  BINDING_UNBIND: 'binding:unbind',
  BINDING_LIST: 'binding:listBoundNotes',
  BINDING_PDF_OF_NOTE: 'binding:pdfOfNote',
  // asset
  ASSET_SAVE: 'asset:save',
  // search
  SEARCH_QUERY: 'search:query',
  SEARCH_REBUILD: 'search:rebuildIndex',
  // settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_GET_RECENT_VAULTS: 'settings:getRecentVaults',
  SETTINGS_ADD_RECENT_VAULT: 'settings:addRecentVault',
  // window
  WINDOW_SHOW_IN_FOLDER: 'window:showInFolder',
  WINDOW_REVEAL_VAULT_IN_OS: 'window:revealVaultInOs'
} as const
