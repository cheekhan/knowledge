/**
 * Electron 主进程入口 — P-12 上线 SettingsService
 */

import { app, BrowserWindow, ipcMain } from 'electron'
import { createWindow, getMainWindow } from './window'
import { createMenu } from './menu'

import { FileSystemService } from './services/FileSystemService'
import { VaultService } from './services/VaultService'
import { FileWatcher } from './services/FileWatcher'
import { IndexService } from './services/IndexService'
import { SettingsService } from './services/SettingsService'
import { ensureDefaultVault } from './services/DefaultVaultService'
import { MetadataService } from './services/MetadataService'
import { BindingService } from './services/BindingService'

import { registerFsIpc } from './ipc/fs.ipc'
import { registerVaultIpc } from './ipc/vault.ipc'
import { registerSearchIpc } from './ipc/search.ipc'
import { registerPdfIpc } from './ipc/pdf.ipc'
import { registerBindingIpc } from './ipc/binding.ipc'
import { registerSettingsIpc } from './ipc/settings.ipc'
import { registerUpdateIpc } from './ipc/update.ipc'
import { UpdateService } from './services/UpdateService'

// ─── 单实例锁 ────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = getMainWindow()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
}

// ─── 服务实例（整个主进程生命周期单例）─────────────────
const fsService = new FileSystemService()
const vaultService = new VaultService()
const fileWatcher = new FileWatcher()
const indexService = new IndexService()
const metaService = new MetadataService()
const bindingService = new BindingService()
const settingsService = new SettingsService()
const updateService = new UpdateService({ getWindow: getMainWindow })

// ─── P-03：绑定服务依赖注入 + 重命名钩子 ──────────────
fsService.setRenameHook(async (oldRel, newRel) => {
  await bindingService.repairOnRename(oldRel, newRel)
})

// IndexService 绑定回调注入 BindingService
bindingService.setIndexCallback({
  upsertBinding: (pdfPath, notePath) =>
    indexService.upsertBinding(pdfPath, notePath),
  removeBinding: (pdfPath, notePath) =>
    indexService.removeBinding(pdfPath, notePath),
  clearBindingsOfPdf: (pdfPath) =>
    indexService.clearBindingsOfPdf(pdfPath),
  pdfOfNote: (notePath) => indexService.pdfOfNote(notePath)
})

// ─── 应用生命周期 ─────────────────────────────────────

app.whenReady().then(() => {
  // 必须先注册 IPC（preload 在窗口创建时就绪）
  registerFsIpc(fsService, getMainWindow)
  registerVaultIpc(vaultService, fsService, fileWatcher, indexService, metaService, bindingService, settingsService, getMainWindow)
  registerSearchIpc(indexService, getMainWindow)
  registerPdfIpc(fsService, metaService, getMainWindow)
  registerBindingIpc(bindingService, getMainWindow)
  registerSettingsIpc(settingsService, getMainWindow)
  registerUpdateIpc(updateService, getMainWindow)

  // 首次启动 → 确保示例库存在
  const defaultVault = ensureDefaultVault()
  ipcMain.handle('vault:getDefault', async () => defaultVault)

  createMenu()
  createWindow()

  // 启动后延迟检查更新（避免影响首屏渲染）
  setTimeout(() => {
    if (!app.isPackaged) return // dev 模式下不检查
    updateService.checkForUpdates().catch(() => {})
  }, 5000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('quit', () => {
  indexService.close()
})
