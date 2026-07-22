/**
 * Vault + 窗口 IPC 注册
 */

import { ipcMain, BrowserWindow, shell, dialog } from 'electron'
import { VaultService } from '../services/VaultService'
import { FileSystemService } from '../services/FileSystemService'
import { FileWatcher } from '../services/FileWatcher'
import { IndexService } from '../services/IndexService'
import { MetadataService } from '../services/MetadataService'
import { BindingService } from '../services/BindingService'
import { SettingsService } from '../services/SettingsService'
import { EVENT_VAULT_CHANGED, EVENT_NOTE_EXTERNALLY_MODIFIED } from '../../shared/constants'
import { assertInsideVault } from '../lib/vaultPath'
import type { VaultChangeEvent } from '../../shared/types'

export function registerVaultIpc(
  vaultService: VaultService,
  fsService: FileSystemService,
  fileWatcher: FileWatcher,
  indexService: IndexService,
  metaService: MetadataService,
  bindingService: BindingService,
  settingsService: SettingsService,
  getWindow: () => BrowserWindow | null
): void {
  // ── vault:open ──────────────────────────────────
  ipcMain.handle('vault:open', async (_event, vaultPath: string) => {
    const summary = vaultService.open(vaultPath)

    // 重新设定所有服务的库根
    fsService.setVaultRoot(vaultPath)
    metaService.setVaultRoot(vaultPath)
    bindingService.inject(vaultPath, metaService, fsService)
    settingsService.setVaultRoot(vaultPath)
    settingsService.addRecentVault(vaultPath)

    // 索引服务切换库（关闭旧库，打开新库）
    indexService.close()
    indexService.open(vaultPath)

    // 停止旧监听，启动新监听
    if (fileWatcher.isWatching()) {
      await fileWatcher.stop()
    }

    fileWatcher.watch(vaultPath, (ev: VaultChangeEvent) => {
      // ① 就地更新缓存树
      const result = vaultService.patchTree(ev)
      if (result === 'full-refresh') {
        vaultService.refreshTree()
      }

      // ② 增量更新索引（P-04）
      if (ev.relPath.endsWith('.md')) {
        if (ev.type === 'add' || ev.type === 'change') {
          indexService.indexNote(ev.relPath)
        } else if (ev.type === 'unlink') {
          indexService.removeNote(ev.relPath)
        }
      } else if (ev.relPath.endsWith('.pdf')) {
        if (ev.type === 'add' || ev.type === 'change') {
          indexService.indexPdf(ev.relPath)
        } else if (ev.type === 'unlink') {
          indexService.removePdf(ev.relPath)
        }
      }

      // ③ 推送给渲染进程
      const win = getWindow()
      if (win && !win.isDestroyed()) {
        if (result === 'full-refresh') {
          win.webContents.send(EVENT_VAULT_CHANGED, {
            type: 'full-refresh',
            relPath: ev.relPath
          } as VaultChangeEvent)
        } else {
          win.webContents.send(EVENT_VAULT_CHANGED, ev)
        }
      }

      // ④ 外部修改笔记冲突检测
      if (ev.type === 'change' && ev.relPath.endsWith('.md')) {
        if (fileWatcher.isDirty(ev.relPath)) {
          const win = getWindow()
          if (win && !win.isDestroyed()) {
            win.webContents.send(EVENT_NOTE_EXTERNALLY_MODIFIED, ev.relPath)
          }
        }
      }
    })

    return summary
  })

  // ── vault:getTree ───────────────────────────────
  ipcMain.handle('vault:getTree', async () => {
    return vaultService.getTree()
  })

  // ── vault:getRecent ─────────────────────────────
  ipcMain.handle('vault:getRecent', async () => {
    return vaultService.getRecent()
  })

  // ── 编辑状态上报（供 Watcher 冲突判断） ────────
  ipcMain.handle('vault:setDirty', async (_event, relPath: string, dirty: boolean) => {
    fileWatcher.setDirty(relPath, dirty)
  })

  ipcMain.handle('vault:markOpened', async (_event, relPath: string) => {
    fileWatcher.markOpen(relPath)
  })

  // ── window:showInFolder ─────────────────────────
  ipcMain.handle('window:showInFolder', async (_event, relPath: string) => {
    const abs = assertInsideVault(fsService.getVaultRoot(), relPath)
    shell.showItemInFolder(abs)
  })

  // ── dialog:openVault ───────────────────────────
  ipcMain.handle('dialog:openVault', async () => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: '选择库文件夹'
    })
    return result.canceled ? null : result.filePaths[0] ?? null
  })

  ipcMain.handle('window:revealVaultInOs', async () => {
    const vaultRoot = vaultService.getVaultRoot()
    if (vaultRoot) {
      shell.openPath(vaultRoot)
    }
  })
}
