/**
 * 虚拟化页面渲染 Hook（重写为 scrollTop 驱动） — O-01.3
 *
 * 不再依赖 IntersectionObserver 和已挂载的 page DOM，
 * 纯基于 scrollTop + 页面估算/实际高度计算可见范围，
 * 确保只挂载可见范围内的页面 DOM。
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { PDF_VISIBLE_BUFFER } from '../../../shared/constants'

export interface VirtualRange {
  /** 第一个需要渲染的页码（1-based），inclusive */
  start: number
  /** 最后一个需要渲染的页码（1-based），inclusive */
  end: number
}

export interface UseVirtualPagesOptions {
  pageCount: number
  /** 滚动容器 ref */
  scrollRef: React.RefObject<HTMLDivElement | null>
  /** 缓冲页数，默认 PDF_VISIBLE_BUFFER */
  buffer?: number
  /**
   * 获取第 pageNum 页的顶部偏移（像素）
   * 容错：pageNum 超出范围时返回安全值
   */
  getPageTop: (pageNum: number) => number
  /**
   * 获取第 pageNum 页的高度（像素）
   */
  getPageHeight: (pageNum: number) => number
}

/**
 * @returns visibleRange 当前应渲染的页码范围
 */
export function useVirtualPages({
  pageCount,
  scrollRef,
  buffer = PDF_VISIBLE_BUFFER,
  getPageTop,
  getPageHeight
}: UseVirtualPagesOptions): {
  visibleRange: VirtualRange
} {
  const [visibleRange, setVisibleRange] = useState<VirtualRange>({
    start: 1,
    end: Math.min(pageCount, 1 + buffer * 2)
  })

  // 缓存上次计算范围避免重复 setState
  const lastRangeRef = useRef<VirtualRange>({ start: 1, end: 1 })

  const computeVisible = useCallback(() => {
    const el = scrollRef.current
    if (!el || pageCount === 0) return

    const scrollTop = el.scrollTop
    const viewportHeight = el.clientHeight
    const bufferMargin = viewportHeight * 0.5 // 额外缓冲：半个视口高度

    const viewTop = scrollTop - bufferMargin
    const viewBottom = scrollTop + viewportHeight + bufferMargin

    let start = pageCount
    let end = 1

    for (let i = 1; i <= pageCount; i++) {
      const top = getPageTop(i)
      const height = getPageHeight(i)
      const bottom = top + height

      // 页面与扩展视口有交集
      if (bottom >= viewTop && top <= viewBottom) {
        if (i < start) start = i
        if (i > end) end = i
      }
      // 如果页面完全在扩展视口上方，且已找到页 → 后续页也不会可见
      if (bottom < viewTop && end > 0 && i > end + buffer * 3) break
    }

    const newStart = Math.max(1, start - buffer)
    const newEnd = Math.min(pageCount, end + buffer)

    const prev = lastRangeRef.current
    if (prev.start === newStart && prev.end === newEnd) return
    lastRangeRef.current = { start: newStart, end: newEnd }
    setVisibleRange({ start: newStart, end: newEnd })
  }, [scrollRef, pageCount, buffer, getPageTop, getPageHeight])

  // 初始计算
  useEffect(() => {
    computeVisible()
  }, [computeVisible])

  // 监听滚动事件
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    let rafId = 0
    const onScroll = () => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        rafId = 0
        computeVisible()
      })
    }

    el.addEventListener('scroll', onScroll, { passive: true })

    // ResizeObserver 监听容器尺寸变化
    const ro = new ResizeObserver(() => computeVisible())
    ro.observe(el)

    return () => {
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [scrollRef, computeVisible])

  return { visibleRange }
}
