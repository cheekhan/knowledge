/**
 * 自动更新服务 — P-14
 *
 * 基于 electron-updater 从 GitHub Releases 检测/下载/安装更新。
 * 事件经 IPC 推送到渲染进程，由 UpdateNotification 组件展示。
 */

import { autoUpdater } from 'electron-updater'
import { BrowserWindow } from 'electron'
import type { UpdateStatus } from '../../shared/types'

export interface UpdateServiceDeps {
  getWindow: () => BrowserWindow | null
}

export class UpdateService {
  private getWindow: () => BrowserWindow | null
  private listeners = new Set<(status: UpdateStatus) => void>()

  constructor(deps: UpdateServiceDeps) {
    this.getWindow = deps.getWindow
    this.setupAutoUpdater()
  }

  /** 注册渲染进程监听器 */
  subscribe(cb: (status: UpdateStatus) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  /** 广播状态到所有渲染进程监听器 */
  private emit(status: UpdateStatus): void {
    // 优先通过 IPC 事件推送到渲染进程
    const win = this.getWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('update:status', status)
    }
    // 同时通知直接注册的监听器
    for (const cb of this.listeners) {
      try { cb(status) } catch { /* ignore */ }
    }
  }

  /** 手动检查更新 */
  async checkForUpdates(): Promise<{ version: string } | null> {
    const result = await autoUpdater.checkForUpdates()
    return result?.updateInfo?.version
      ? { version: result.updateInfo.version }
      : null
  }

  /** 下载并安装更新 */
  downloadAndInstall(): void {
    autoUpdater.downloadUpdate()
  }

  // ── autoUpdater 事件绑定 ─────────────────────

  private setupAutoUpdater(): void {
    autoUpdater.autoDownload = false   // 手动控制下载，先通知用户
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.allowDowngrade = false
    // 允许预发布版本（如果需要发布 beta，改为 true）
    autoUpdater.allowPrerelease = false

    autoUpdater.on('checking-for-update', () => {
      this.emit({ phase: 'checking' })
    })

    autoUpdater.on('update-available', (info) => {
      this.emit({ phase: 'available', version: info.version })
    })

    autoUpdater.on('update-not-available', () => {
      this.emit({ phase: 'not-available' })
    })

    autoUpdater.on('download-progress', (progress) => {
      this.emit({ phase: 'downloading', progress: Math.round(progress.percent) })
    })

    autoUpdater.on('update-downloaded', (info) => {
      this.emit({ phase: 'downloaded', version: info.version })
    })

    autoUpdater.on('error', (err) => {
      this.emit({ phase: 'error', error: err.message })
    })
  }

  /** 安装已下载的更新并重启 */
  quitAndInstall(): void {
    autoUpdater.quitAndInstall()
  }
}
