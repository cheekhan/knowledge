/**
 * 绑定服务 — window.api.binding 的领域封装
 */

import type { BoundNoteInfo } from '../../shared/types'

export const bindingService = {
  async createBoundNote(
    pdfPath: string,
    opts?: { dir?: string; name?: string }
  ): Promise<string> {
    return window.api.binding.createBoundNote(pdfPath, opts)
  },

  async unbind(pdfPath: string, notePath: string): Promise<void> {
    await window.api.binding.unbind(pdfPath, notePath)
  },

  async listBoundNotes(pdfPath: string): Promise<BoundNoteInfo[]> {
    return window.api.binding.listBoundNotes(pdfPath)
  },

  async pdfOfNote(notePath: string): Promise<string | null> {
    return window.api.binding.pdfOfNote(notePath)
  }
} as const
