/**
 * 搜索 IPC 注册
 */

import { ipcMain, BrowserWindow } from 'electron'
import { IndexService } from '../services/IndexService'
import type { SearchOptions } from '../../shared/types'

export function registerSearchIpc(
  indexService: IndexService,
  _getWindow: () => BrowserWindow | null
): void {
  ipcMain.handle(
    'search:query',
    async (_event, q: string, opts?: SearchOptions) => {
      return indexService.query(q, opts)
    }
  )

  ipcMain.handle('search:rebuildIndex', async () => {
    // 进度在 P-12 通过 EVENTS 推送，当前直接执行
    indexService.rebuild()
  })
}
