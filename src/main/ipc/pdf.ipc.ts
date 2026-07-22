/**
 * PDF IPC 注册
 */

import { ipcMain, BrowserWindow } from 'electron'
import { FileSystemService } from '../services/FileSystemService'
import { MetadataService } from '../services/MetadataService'
import type { PdfMeta } from '../../shared/types'

export function registerPdfIpc(
  fsService: FileSystemService,
  metaService: MetadataService,
  _getWindow: () => BrowserWindow | null
): void {
  ipcMain.handle('pdf:readBuffer', async (_event, relPath: string) => {
    const buf = fsService.readBuffer(relPath)
    // 返回 ArrayBuffer 给渲染进程
    return buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength
    )
  })

  ipcMain.handle('pdf:getMeta', async (_event, relPath: string) => {
    return metaService.read(relPath) as PdfMeta
  })

  ipcMain.handle(
    'pdf:updateMeta',
    async (_event, relPath: string, patch: Partial<PdfMeta>) => {
      metaService.update(relPath, patch)
    }
  )

  ipcMain.handle('pdf:listByTag', async (_event, _tag: string) => {
    // 全量扫 sidecar → 返回匹配 PDF 路径
    return [] // P-09 根据需要实现
  })
}
