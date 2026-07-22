/**
 * 绑定 IPC 注册
 */

import { ipcMain, BrowserWindow } from 'electron'
import { BindingService } from '../services/BindingService'
import type { BoundNoteInfo } from '../../shared/types'

export function registerBindingIpc(
  bindingService: BindingService,
  _getWindow: () => BrowserWindow | null
): void {
  ipcMain.handle(
    'binding:createBoundNote',
    async (
      _event,
      pdfPath: string,
      opts?: { dir?: string; name?: string }
    ) => {
      return bindingService.createBoundNote(pdfPath, opts)
    }
  )

  ipcMain.handle(
    'binding:unbind',
    async (_event, pdfPath: string, notePath: string) => {
      bindingService.unbind(pdfPath, notePath)
    }
  )

  ipcMain.handle(
    'binding:listBoundNotes',
    async (_event, pdfPath: string): Promise<BoundNoteInfo[]> => {
      return bindingService.listBoundNotes(pdfPath)
    }
  )

  ipcMain.handle(
    'binding:pdfOfNote',
    async (_event, notePath: string) => {
      return bindingService.pdfOfNote(notePath)
    }
  )
}
