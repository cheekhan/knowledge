/**
 * 虚拟化页面渲染 Hook — P-08 架构 5.3 要求
 *
 * 使用 IntersectionObserver 计算当前可见页范围，只渲染视口 ±buffer 页，
 * 配合 PageCache(LRU 50) 保证 300 页 PDF 内存 < 800MB。
 */

import { useEffect, useRef, useState, useCallback } from 'react'

/** 视口上下各多渲染的缓冲页数 */
const BUFFER_PAGES = 2

export interface VirtualRange {
  /** 第一个需要渲染的页码（1-based），inclusive */
  start: number
  /** 最后一个需要渲染的页码（1-based），inclusive */
  end: number
}

export interface UseVirtualPagesOptions {
  pageCount: number
  /** 滚动容器 ref */
  scrollRef: React.RefObject<HTMLDivElement>
  /** 缓冲页数，默认 2 */
  buffer?: number
}

/**
 * @returns visibleRange 当前应渲染的页码范围
 * @returns registerPage 注册页面 DOM 元素的回调（用于 IntersectionObserver 监听）
 */
export function useVirtualPages({
  pageCount,
  scrollRef,
  buffer = BUFFER_PAGES
}: UseVirtualPagesOptions): {
  visibleRange: VirtualRange
  registerPage: (pageNum: number, el: HTMLElement | null) => void
} {
  const [visibleRange, setVisibleRange] = useState<VirtualRange>({
    start: 1,
    end: Math.min(pageCount, 1 + buffer * 2)
  })

  const pageElementsRef = useRef<Map<number, HTMLElement>>(new Map())
  const observerRef = useRef<IntersectionObserver | null>(null)

  // 注册/注销页面 DOM 元素
  const registerPage = useCallback((pageNum: number, el: HTMLElement | null) => {
    const map = pageElementsRef.current
    const observer = observerRef.current
    if (el) {
      map.set(pageNum, el)
      observer?.observe(el)
    } else {
      const old = map.get(pageNum)
      if (old) observer?.unobserve(old)
      map.delete(pageNum)
    }
  }, [])

  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl || pageCount === 0) return

    // 收集当前可见页码
    const computeVisible = () => {
      const el = scrollRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const top = rect.top
      const bottom = rect.bottom
      const visiblePages: number[] = []

      pageElementsRef.current.forEach((pageEl, pageNum) => {
        const r = pageEl.getBoundingClientRect()
        // 页面与视口有交集即为可见
        if (r.bottom > top && r.top < bottom) {
          visiblePages.push(pageNum)
        }
      })

      if (visiblePages.length === 0) return

      const minPage = Math.min(...visiblePages)
      const maxPage = Math.max(...visiblePages)

      const newStart = Math.max(1, minPage - buffer)
      const newEnd = Math.min(pageCount, maxPage + buffer)

      setVisibleRange((prev) => {
        if (prev.start === newStart && prev.end === newEnd) return prev
        return { start: newStart, end: newEnd }
      })
    }

    // 首次计算
    computeVisible()

    // 滚动时重新计算
    const onScroll = () => computeVisible()
    scrollEl.addEventListener('scroll', onScroll, { passive: true })

    // ResizeObserver 监听容器尺寸变化（缩放导致页面高度变化）
    const ro = new ResizeObserver(() => computeVisible())
    ro.observe(scrollEl)

    return () => {
      scrollEl.removeEventListener('scroll', onScroll)
      ro.disconnect()
    }
  }, [pageCount, scrollRef, buffer])

  // IntersectionObserver 在页面元素动态增删时触发可见范围更新
  useEffect(() => {
    const observer = new IntersectionObserver(
      () => {
        // 委托给 scroll handler 中的 computeVisible 逻辑
        const el = scrollRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const top = rect.top
        const bottom = rect.bottom
        const visiblePages: number[] = []

        pageElementsRef.current.forEach((pageEl, pageNum) => {
          const r = pageEl.getBoundingClientRect()
          if (r.bottom > top && r.top < bottom) {
            visiblePages.push(pageNum)
          }
        })

        if (visiblePages.length === 0) return

        const minPage = Math.min(...visiblePages)
        const maxPage = Math.max(...visiblePages)

        setVisibleRange((prev) => {
          const newStart = Math.max(1, minPage - buffer)
          const newEnd = Math.min(pageCount, maxPage + buffer)
          if (prev.start === newStart && prev.end === newEnd) return prev
          return { start: newStart, end: newEnd }
        })
      },
      {
        root: scrollRef.current,
        // 扩大检测范围，确保缓冲页也被感知
        rootMargin: '200% 0px 200% 0px',
        threshold: 0
      }
    )

    observerRef.current = observer

    // 重新观察已注册的元素
    pageElementsRef.current.forEach((el) => observer.observe(el))

    return () => {
      observer.disconnect()
      observerRef.current = null
    }
  }, [pageCount, scrollRef, buffer])

  return { visibleRange, registerPage }
}
