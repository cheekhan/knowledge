/**
 * PDF 阅读器状态 — 页码、缩放、标注、绑定笔记
 */

import { create } from 'zustand'
import type { PdfMeta, BoundNoteInfo } from '../../shared/types'
import { SCALE_MIN, SCALE_MAX } from '../../shared/constants'

interface PdfState {
  pdfPath: string | null
  currentPage: number
  scale: number
  meta: PdfMeta | null
  boundNotes: BoundNoteInfo[]
  selectedAnnotationId: string | null
  loading: boolean

  open(path: string, meta: PdfMeta, boundNotes: BoundNoteInfo[]): void
  setPage(page: number): void
  setScale(scale: number): void
  setMeta(meta: PdfMeta): void
  setBoundNotes(boundNotes: BoundNoteInfo[]): void
  selectAnnotation(id: string | null): void
  setLoading(v: boolean): void
  close(): void
}

export const usePdfStore = create<PdfState>((set) => ({
  pdfPath: null,
  currentPage: 1,
  scale: 1,
  meta: null,
  boundNotes: [],
  selectedAnnotationId: null,
  loading: false,

  open(path, meta, boundNotes) {
    set({
      pdfPath: path,
      currentPage: meta.lastPage > 0 ? meta.lastPage : 1,
      scale: 1,
      meta,
      boundNotes,
      selectedAnnotationId: null,
      loading: false
    })
  },

  setPage(page) {
    set({ currentPage: Math.max(1, page) })
  },

  setScale(scale) {
    set({ scale: Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale)) })
  },

  setMeta(meta) {
    set({ meta })
  },

  setBoundNotes(boundNotes) {
    set({ boundNotes })
  },

  selectAnnotation(id) {
    set({ selectedAnnotationId: id })
  },

  setLoading(v) {
    set({ loading: v })
  },

  close() {
    set({
      pdfPath: null,
      currentPage: 1,
      scale: 1,
      meta: null,
      boundNotes: [],
      selectedAnnotationId: null,
      loading: false
    })
  }
}))
