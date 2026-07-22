/**
 * 自动更新 IPC 注册 — P-14
 */

import { ipcMain } from 'electron'
import type { UpdateService } from '../services/UpdateService'
import type { BrowserWindow } from 'electron'

export function registerUpdateIpc(
  updateService: UpdateService,
  _getWindow: () => BrowserWindow | null
): void {
  ipcMain.handle('update:checkForUpdates', async () => {
    return updateService.checkForUpdates()
  })

  ipcMain.handle('update:downloadAndInstall', async () => {
    updateService.downloadAndInstall()
  })

  ipcMain.handle('update:quitAndInstall', async () => {
    updateService.quitAndInstall()
  })
}
