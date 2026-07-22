/**
 * PDF 服务 — window.api.pdf 的领域封装
 */

import type { PdfMeta } from '../../shared/types'

export const pdfService = {
  async readBuffer(relPath: string): Promise<ArrayBuffer> {
    return window.api.pdf.readBuffer(relPath)
  },

  async getMeta(relPath: string): Promise<PdfMeta> {
    return window.api.pdf.getMeta(relPath)
  },

  async updateMeta(relPath: string, patch: Partial<PdfMeta>): Promise<void> {
    await window.api.pdf.updateMeta(relPath, patch)
  }
} as const
