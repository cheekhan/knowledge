/**
 * 文件系统 IPC 注册 — note.* + 内部辅助
 */

import { ipcMain, BrowserWindow } from 'electron'
import { FileSystemService } from '../services/FileSystemService'

export function registerFsIpc(
  fsService: FileSystemService,
  _getWindow: () => BrowserWindow | null
): void {
  // ── note:read ──────────────────────────────────
  ipcMain.handle('note:read', async (_event, relPath: string) => {
    return fsService.readNote(relPath)
  })

  // ── note:write ──────────────────────────────────
  ipcMain.handle('note:write', async (_event, relPath: string, content: string) => {
    fsService.writeNote(relPath, content)
    // 写入后路由脏状态清理由 renderer 端 service 负责
  })

  // ── note:rename ─────────────────────────────────
  ipcMain.handle('note:rename', async (_event, oldPath: string, newPath: string) => {
    await fsService.rename(oldPath, newPath)
  })

  // ── note:move ───────────────────────────────────
  ipcMain.handle('note:move', async (_event, fromPath: string, toDir: string) => {
    await fsService.move(fromPath, toDir)
  })

  // ── note:delete ─────────────────────────────────
  ipcMain.handle('note:delete', async (_event, relPath: string) => {
    await fsService.delete(relPath)
  })

  // ── note:onExternallyModified（由 Watcher 推送，此处仅占位）──
  // 实际推送在 registerVaultIpc → FileWatcher 回调中
}
