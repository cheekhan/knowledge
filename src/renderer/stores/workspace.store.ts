/**
 * 工作区布局状态机 — P-05 核心
 *
 * DockState 判别联合控制分屏视图：
 * - 'note':  仅笔记编辑器
 * - 'pdf':   仅 PDF 阅读器
 * - 'split': 左 PDF + 右笔记（通过 pdfSide 切换）
 *
 * 状态变迁规则参见架构文档 5.1
 */

import { create } from 'zustand'
import { DEFAULT_SPLIT_RATIO, MIN_SPLIT_RATIO, MAX_SPLIT_RATIO } from '../../shared/constants'

// ── 类型 ──────────────────────────────────────────

export type PdfSide = 'left' | 'right'

export type DockState =
  | { mode: 'note'; notePath: string }
  | { mode: 'pdf'; pdfPath: string; page: number }
  | {
      mode: 'split'
      pdfPath: string
      page: number
      notePath: string
      splitRatio: number
      pdfSide: PdfSide
    }

interface WorkspaceState {
  dock: DockState | null

  // ── actions ────────────────────────────────────

  /** 打开笔记（独立模式） */
  openNote(notePath: string): void

  /** 打开 PDF（独立模式） */
  openPdf(pdfPath: string, page?: number): void

  /** 分屏模式：PDF + 笔记 */
  openSplit(
    pdfPath: string,
    notePath: string,
    opts?: { page?: number; pdfSide?: PdfSide }
  ): void

  /** 在已有 split 中切换右侧笔记 */
  switchNote(notePath: string): void

  /** 关闭笔记侧（退化） */
  closeNote(): void

  /** 关闭 PDF 侧（退化） */
  closePdf(): void

  /** 调整分屏比例 */
  setSplitRatio(ratio: number): void

  /** 互换左右 */
  togglePdfSide(): void

  /** 设置 PDF 当前页 */
  setPage(page: number): void

  /** 关闭工作区 */
  close(): void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  dock: null,

  openNote(notePath) {
    set({ dock: { mode: 'note', notePath } })
  },

  openPdf(pdfPath, page = 1) {
    set({ dock: { mode: 'pdf', pdfPath, page } })
  },

  openSplit(pdfPath, notePath, opts) {
    set({
      dock: {
        mode: 'split',
        pdfPath,
        page: opts?.page ?? 1,
        notePath,
        splitRatio: DEFAULT_SPLIT_RATIO,
        pdfSide: opts?.pdfSide ?? 'left'
      }
    })
  },

  switchNote(notePath) {
    set((state) => {
      if (state.dock?.mode === 'split') {
        return { dock: { ...state.dock, notePath } }
      }
      return state
    })
  },

  closeNote() {
    set((state) => {
      if (state.dock?.mode === 'split') {
        return { dock: { mode: 'pdf', pdfPath: state.dock.pdfPath, page: state.dock.page } }
      }
      if (state.dock?.mode === 'note') {
        return { dock: null }
      }
      return state
    })
  },

  closePdf() {
    set((state) => {
      if (state.dock?.mode === 'split') {
        return { dock: { mode: 'note', notePath: state.dock.notePath } }
      }
      if (state.dock?.mode === 'pdf') {
        return { dock: null }
      }
      return state
    })
  },

  setSplitRatio(ratio) {
    const clamped = Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, ratio))
    set((state) => {
      if (state.dock?.mode === 'split') {
        return { dock: { ...state.dock, splitRatio: clamped } }
      }
      return state
    })
  },

  togglePdfSide() {
    set((state) => {
      if (state.dock?.mode === 'split') {
        const newSide: PdfSide = state.dock.pdfSide === 'left' ? 'right' : 'left'
        return { dock: { ...state.dock, pdfSide: newSide } }
      }
      return state
    })
  },

  setPage(page) {
    set((state) => {
      if (state.dock && 'page' in state.dock) {
        return { dock: { ...state.dock, page } }
      }
      return state
    })
  },

  close() {
    set({ dock: null })
  }
}))
