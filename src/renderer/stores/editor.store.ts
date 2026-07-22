/**
 * 编辑器状态 — 内容、保存状态、光标
 */

import { create } from 'zustand'

export type SaveState = 'saved' | 'saving' | 'unsaved'

interface EditorState {
  /** 当前编辑的笔记路径（null = 无打开） */
  currentPath: string | null
  /** 当前内容 */
  content: string
  /** 保存状态 */
  saveState: SaveState
  /** 是否有未保存更改 */
  isDirty: boolean

  /** 打开文件 */
  open(path: string, content: string): void

  /** 更新内容（标记 dirty） */
  setContent(content: string): void

  /** 保存中 */
  setSaving(): void

  /** 保存完成 */
  setSaved(): void

  /** 外部重载（覆盖内容并清除 dirty） */
  reload(content: string): void

  /** 关闭 */
  close(): void
}

export const useEditorStore = create<EditorState>((set) => ({
  currentPath: null,
  content: '',
  saveState: 'saved',
  isDirty: false,

  open(path, content) {
    set({
      currentPath: path,
      content,
      saveState: 'saved',
      isDirty: false
    })
  },

  setContent(content) {
    set({
      content,
      isDirty: true,
      saveState: 'unsaved'
    })
  },

  setSaving() {
    set({ saveState: 'saving' })
  },

  setSaved() {
    set({
      saveState: 'saved',
      isDirty: false
    })
  },

  reload(content) {
    set({
      content,
      saveState: 'saved',
      isDirty: false
    })
  },

  close() {
    set({
      currentPath: null,
      content: '',
      saveState: 'saved',
      isDirty: false
    })
  }
}))
