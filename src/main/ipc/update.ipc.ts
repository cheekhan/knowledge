/**
 * 自动更新 IPC 注册 — P-14
 */

import type { UpdateService } from '../services/UpdateService'
import type { BrowserWindow } from 'electron'
import type { UpdateStatus } from '../../shared/types'

export function registerUpdateIpc(
  updateService: UpdateService,
  getWindow: () => BrowserWindow | null
): void {
  const { ipcMain } = require('electron')

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
