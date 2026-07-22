/**
 * IPC 通道接口定义 — 主进程与渲染进程的唯一契约来源
 *
 * 规则：
 * - 本文件是 P-02 ~ P-13 所有 IPC 实现的接口依据
 * - 修改本文件视同契约变更（A.4 流程），需同步改 preload + main handler
 * - 禁止任何运行时代码（纯类型）
 */

import type {
  VaultSummary,
  VaultChangeEvent,
  FileTreeNode,
  PdfMeta,
  BoundNoteInfo,
  SearchHit,
  SearchOptions,
  AppSettings,
  RecentVaultEntry,
  UpdateStatus,
  Unsubscribe
} from './types'

/**
 * window.api 暴露的全部 IPC 接口
 *
 * 渲染进程只通过 services/*.service.ts 调用 window.api，
 * 组件禁止直接访问 window.api。
 */
export interface IpcApi {
  // ==========================================
  // vault — 库管理
  // ==========================================
  vault: {
    /**
     * 打开/切换到指定 Vault
     * @param path Vault 根目录绝对路径
     * @returns 扫描后的库摘要
     */
    open(path: string): Promise<VaultSummary>

    /**
     * 获取当前打开库的文件树
     * @returns PDF 节点含 boundNotes 子节点
     */
    getTree(): Promise<FileTreeNode[]>

    /**
     * 获取最近打开的库列表
     */
    getRecent(): Promise<RecentVaultEntry[]>

    /**
     * 订阅 Vault 变更事件
     * @returns 取消订阅函数
     */
    onVaultChanged(cb: (event: VaultChangeEvent) => void): Unsubscribe

    /**
     * 弹出系统文件夹选择对话框
     * @returns 选中的文件夹路径，取消返回 null
     */
    browseFolder(): Promise<string | null>
  }

  // ==========================================
  // note — 笔记文件 CRUD
  // ==========================================
  note: {
    /**
     * 读取笔记全文
     * @param relPath 库内相对路径
     */
    read(relPath: string): Promise<string>

    /**
     * 原子写入笔记（tmp + fsync + rename）
     * @param relPath 库内相对路径
     * @param content 完整内容（非增量）
     */
    write(relPath: string, content: string): Promise<void>

    /**
     * 重命名笔记或文件夹，内部触发绑定路径修复
     * @param oldPath 当前相对路径
     * @param newPath 新相对路径
     */
    rename(oldPath: string, newPath: string): Promise<void>

    /**
     * 移动笔记/文件夹到目标目录
     * @param fromPath 当前相对路径
     * @param toDir 目标目录相对路径
     */
    move(fromPath: string, toDir: string): Promise<void>

    /**
     * 删除（移入系统回收站）
     * 若为绑定笔记，内部先解绑再删除
     * @param relPath 库内相对路径
     */
    delete(relPath: string): Promise<void>

    /**
     * 订阅笔记外部修改事件（编辑中文件被其他程序修改时触发）
     * @returns 取消订阅函数
     */
    onExternallyModified(cb: (relPath: string) => void): Unsubscribe
  }

  // ==========================================
  // pdf — PDF 读取与元数据
  // ==========================================
  pdf: {
    /**
     * 读取 PDF 原始二进制数据
     * @param relPath 库内相对路径
     * @returns PDF 文件 ArrayBuffer
     */
    readBuffer(relPath: string): Promise<ArrayBuffer>

    /**
     * 读取 PDF sidecar 元数据
     * @param relPath 库内相对路径
     */
    getMeta(relPath: string): Promise<PdfMeta>

    /**
     * 部分更新 PDF sidecar 元数据（read-modify-write + 原子写）
     * @param relPath 库内相对路径
     * @param patch 需要更新的字段（浅合并）
     */
    updateMeta(relPath: string, patch: Partial<PdfMeta>): Promise<void>

    /**
     * 按标签筛选 PDF 文件
     * @param tag 标签名
     * @returns 匹配的 PDF 相对路径列表
     */
    listByTag(tag: string): Promise<string[]>
  }

  // ==========================================
  // binding — PDF-笔记 绑定关系
  // ==========================================
  binding: {
    /**
     * 创建一篇绑定笔记
     *
     * 流程：
     * 1. 确定目录与文件名（N 自动递增）
     * 2. 原子写 md（含默认标题与来源提示行）
     * 3. 路径注入 sidecar boundNotes
     * 4. 返回新笔记的库内相对路径
     *
     * @param pdfPath PDF 相对路径
     * @param opts.dir 自定义目录（默认 notes/<PDF文件名>/）
     * @param opts.name 自定义文件名（默认《PDF名》笔记 N.md）
     * @returns 新笔记的库内相对路径
     */
    createBoundNote(
      pdfPath: string,
      opts?: { dir?: string; name?: string }
    ): Promise<string>

    /**
     * 解除绑定（仅从 boundNotes 移除路径，md 文件保留）
     * @param pdfPath PDF 相对路径
     * @param notePath 笔记相对路径
     */
    unbind(pdfPath: string, notePath: string): Promise<void>

    /**
     * 列出某 PDF 的全部绑定笔记
     * @param pdfPath PDF 相对路径
     * @returns 绑定笔记列表（含 missing 标记与标题）
     */
    listBoundNotes(pdfPath: string): Promise<BoundNoteInfo[]>

    /**
     * 反查：给定笔记绑定的 PDF
     * @param notePath 笔记相对路径
     * @returns PDF 相对路径，未绑定时返回 null
     */
    pdfOfNote(notePath: string): Promise<string | null>
  }

  // ==========================================
  // asset — 附件/图片保存
  // ==========================================
  asset: {
    /**
     * 保存附件到 assets/ 目录
     * @param filename 文件名（含扩展名）
     * @param buffer 文件二进制数据
     * @returns 库内相对路径
     */
    save(filename: string, buffer: ArrayBuffer): Promise<string>
  }

  // ==========================================
  // settings — 应用设置
  // ==========================================
  settings: {
    /**
     * 读取应用设置
     */
    get(): Promise<AppSettings>

    /**
     * 部分更新应用设置（浅合并）
     * @param patch 需要更新的字段
     */
    update(patch: Partial<AppSettings>): Promise<void>

    /**
     * 获取最近打开的库列表
     */
    getRecentVaults(): Promise<RecentVaultEntry[]>

    /**
     * 添加一条最近库记录
     * @param vaultPath Vault 根目录绝对路径
     */
    addRecentVault(vaultPath: string): Promise<void>
  }

  // ==========================================
  // window — 窗口与系统交互
  // ==========================================
  window: {
    /**
     * 在系统文件管理器中定位并高亮文件
     * @param relPath 库内相对路径
     */
    showInFolder(relPath: string): Promise<void>

    /**
     * 在系统文件管理器中打开当前 Vault 根目录
     */
    revealVaultInOs(): Promise<void>
  }

  // ==========================================
  // search — 全文搜索
  // ==========================================
  search: {
    /**
     * 全文搜索
     * @param q 搜索关键词
     * @param opts 搜索选项
     * @returns 搜索结果列表
     */
    query(q: string, opts?: SearchOptions): Promise<SearchHit[]>

    /**
     * 全量重建索引（异步，进度经 vault:changed 事件推送）
     */
    rebuildIndex(): Promise<void>
  }

  // ==========================================
  // update — 自动升级（P-14）
  // ==========================================
  update: {
    /**
     * 手动触发更新检查
     * @returns 最新版本号，无可更新时返回 null
     */
    checkForUpdates(): Promise<{ version: string } | null>

    /**
     * 开始下载更新
     */
    downloadAndInstall(): Promise<void>

    /**
     * 退出应用并安装已下载的更新
     */
    quitAndInstall(): Promise<void>

    /**
     * 订阅更新状态事件
     * @returns 取消订阅函数
     */
    onUpdateStatus(cb: (status: UpdateStatus) => void): Unsubscribe
  }
}
