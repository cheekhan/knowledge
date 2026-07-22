/**
 * 懒加载页面尺寸 Hook — O-01.2
 *
 * 替代打开 PDF 时全量 getPageDimensions()：
 * - 首屏只解析目标页 ±1 的尺寸
 * - 后续按需加载（滚动到的页面、可见范围内页面）
 * - 后台空闲时渐进加载全部尺寸（preloadAll），让虚拟滚动高度精确
 * - 并发上限 PDF_DIM_FETCH_CONCURRENCY
 * - 未加载页用第 1 页尺寸或 A4 估算
 *
 * 关键修复：ensureDim 不再依赖 dims 数组身份，避免每次尺寸加载都重建函数，
 * 从而保证页面挂载后能可靠地按需加载自身尺寸（不再卡在骨架/白屏）。
 */

import { useState, useRef, useCallback } from 'react'
import { PDF_DIM_FETCH_CONCURRENCY } from '../../../shared/constants'
import type { PdfEngine, PageDimension } from './engine/PdfEngine'

export interface PageDimensionsState {
  /** 已解析的真实尺寸；未解析的页为 null */
  dims: (PageDimension | null)[]
  /** 获取单页尺寸（带 memo + 并发上限），已解析/进行中则直接复用 */
  ensureDim(pageNum: number): Promise<PageDimension>
  /** 估算高度（用于未加载页） */
  estimateHeight(pageNum: number, scale: number): number
  /** 批量预加载尺寸（后台，不阻塞） */
  preloadRange(start: number, end: number): void
  /** 后台空闲渐进加载 [start,end] 全部尺寸，使虚拟滚动高度精确 */
  preloadAll(start: number, end: number): void
}

/** A4 比例默认尺寸（pt），作为兜底估算 */
const DEFAULT_PAGE: PageDimension = { width: 595, height: 842 }

export function usePageDimensions(
  engine: PdfEngine | null,
  pageCount: number,
  /** 初始优先加载 targetPage±1 */
  _targetPage: number
): PageDimensionsState {
  const [dims, setDims] = useState<(PageDimension | null)[]>(() =>
    Array.from({ length: pageCount }, () => null)
  )

  /** 用 ref 持有最新 dims，使 ensureDim/estimateHeight 不随 dims 变化而重建 */
  const dimsRef = useRef<(PageDimension | null)[]>(dims)
  dimsRef.current = dims

  const pendingRef = useRef<Map<number, Promise<PageDimension>>>(new Map())
  const activeCountRef = useRef(0)

  /** 确保第 num 页尺寸已解析 */
  const ensureDim = useCallback(async (pageNum: number): Promise<PageDimension> => {
    // 已解析
    const existing = dimsRef.current[pageNum - 1]
    if (existing) return existing

    // 已有正在进行的请求
    const pending = pendingRef.current.get(pageNum)
    if (pending) return pending

    // 创建新请求（受并发限制）
    const load = async (): Promise<PageDimension> => {
      while (activeCountRef.current >= PDF_DIM_FETCH_CONCURRENCY) {
        await new Promise((r) => setTimeout(r, 10))
      }
      activeCountRef.current++
      try {
        if (!engine) throw new Error('engine not ready')
        const dim = await engine.getPageDimension(pageNum)
        setDims((prev) => {
          const next = [...prev]
          next[pageNum - 1] = dim
          return next
        })
        return dim
      } finally {
        activeCountRef.current--
        pendingRef.current.delete(pageNum)
      }
    }

    const promise = load()
    pendingRef.current.set(pageNum, promise)
    return promise
  }, [engine])

  /** 估算未加载页的高度：优先第 1 页尺寸，其次 A4 默认 */
  const estimateHeight = useCallback((pageNum: number, scale: number): number => {
    const d = dimsRef.current[pageNum - 1]
    if (d) return Math.ceil(d.height * scale)
    // 第 1 页已加载时用它估算
    const first = dimsRef.current[0]
    const ref = first ?? DEFAULT_PAGE
    return Math.ceil(ref.height * scale)
  }, [])

  /** 后台批量预加载尺寸 */
  const preloadRange = useCallback((start: number, end: number) => {
    const clampedStart = Math.max(1, start)
    const clampedEnd = Math.min(pageCount, end)
    for (let i = clampedStart; i <= clampedEnd; i++) {
      ensureDim(i).catch(() => {})
    }
  }, [ensureDim, pageCount])

  /** 后台空闲渐进加载全部尺寸：让虚拟滚动总高度精确，避免可见范围算错 */
  const preloadAll = useCallback((start: number, end: number) => {
    const CHUNK = 16
    let i = Math.max(1, start)
    const schedule = (cb: () => void) => {
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(cb, { timeout: 200 })
      } else {
        setTimeout(cb, 16)
      }
    }
    const step = () => {
      if (i > end) return
      const next = Math.min(i + CHUNK - 1, end)
      for (let p = i; p <= next; p++) {
        ensureDim(p).catch(() => {})
      }
      i = next + 1
      if (i <= end) schedule(step)
    }
    schedule(step)
  }, [ensureDim, pageCount])

  return { dims, ensureDim, estimateHeight, preloadRange, preloadAll }
}
