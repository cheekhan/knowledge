/**
 * PDF 页面 Canvas LRU 缓存 — 上限 50 页
 */

import { PDF_CACHE_CAPACITY } from '../../../shared/constants'

interface CacheEntry {
  canvas: HTMLCanvasElement
  pageNum: number
}

export class PageCache {
  private cache = new Map<number, CacheEntry>()
  private order: number[] = []

  get(pageNum: number): HTMLCanvasElement | null {
    const entry = this.cache.get(pageNum)
    if (!entry) return null
    // LRU: 移到队列末尾
    this.order = this.order.filter((p) => p !== pageNum)
    this.order.push(pageNum)
    return entry.canvas
  }

  set(pageNum: number, canvas: HTMLCanvasElement): void {
    // 淘汰最久未使用
    if (this.cache.size >= PDF_CACHE_CAPACITY && !this.cache.has(pageNum)) {
      const oldest = this.order.shift()
      if (oldest !== undefined) {
        const entry = this.cache.get(oldest)
        if (entry) {
          entry.canvas.width = 0
          entry.canvas.height = 0
        }
        this.cache.delete(oldest)
      }
    }

    // 已存在则更新位置
    this.order = this.order.filter((p) => p !== pageNum)
    this.cache.set(pageNum, { canvas, pageNum })
    this.order.push(pageNum)
  }

  clear(): void {
    for (const [, entry] of this.cache) {
      entry.canvas.width = 0
      entry.canvas.height = 0
    }
    this.cache.clear()
    this.order = []
  }

  size(): number {
    return this.cache.size
  }
}
