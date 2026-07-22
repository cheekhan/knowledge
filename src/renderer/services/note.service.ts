/**
 * 笔记服务 — window.api.note 的领域封装
 *
 * 红线 R2：组件只 import services，不直接调 window.api
 */

import type { Unsubscribe } from '../../shared/types'

export const noteService = {
  async read(relPath: string): Promise<string> {
    return window.api.note.read(relPath)
  },

  async write(relPath: string, content: string): Promise<void> {
    await window.api.note.write(relPath, content)
  },

  async rename(oldPath: string, newPath: string): Promise<void> {
    await window.api.note.rename(oldPath, newPath)
  },

  async move(fromPath: string, toDir: string): Promise<void> {
    await window.api.note.move(fromPath, toDir)
  },

  async delete(relPath: string): Promise<void> {
    await window.api.note.delete(relPath)
  },

  onExternallyModified(cb: (relPath: string) => void): Unsubscribe {
    return window.api.note.onExternallyModified(cb)
  }
} as const
