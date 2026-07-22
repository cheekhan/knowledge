import { ipcMain, BrowserWindow } from 'electron'
import { SettingsService } from '../services/SettingsService'
import type { AppSettings } from '../../shared/types'

export function registerSettingsIpc(
  settingsService: SettingsService,
  _getWindow: () => BrowserWindow | null
): void {
  ipcMain.handle('settings:get', async () => settingsService.get())

  ipcMain.handle(
    'settings:update',
    async (_e, patch: Partial<AppSettings>) => settingsService.update(patch)
  )

  ipcMain.handle('settings:getRecentVaults', async () =>
    settingsService.getRecentVaults()
  )

  ipcMain.handle('settings:addRecentVault', async (_e, p: string) =>
    settingsService.addRecentVault(p)
  )
}
