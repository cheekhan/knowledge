/**
 * PDF 页面 Canvas 缓存
 *
 * 改为「离屏副本」策略：渲染完成的页面位图拷贝进独立的离屏 canvas，
 * 与当前 DOM 中的 canvas 生命周期解耦。这样做的好处：
 *  1. 淘汰缓存时只会释放离屏副本，绝不会把正在显示的页面清成白屏；
 *  2. 通过像素总预算（PDF_MAX_CACHE_PIXELS）限制内存占用，
 *     避免高分辨率下显存/内存爆炸导致 GPU 丢弃纹理 → 白屏。
 */

import { PDF_CACHE_CAPACITY, PDF_MAX_CACHE_PIXELS } from '../../../shared/constants'

interface CacheEntry {
  canvas: HTMLCanvasElement
  pageNum: number
  pixels: number
}

export class PageCache {
  private cache = new Map<number, CacheEntry>()
  /** LRU 顺序（队首最久未用） */
  private order: number[] = []
  /** 当前缓存像素总量，用于预算淘汰 */
  private totalPixels = 0

  get(pageNum: number): HTMLCanvasElement | null {
    const entry = this.cache.get(pageNum)
    if (!entry) return null
    // LRU: 移到队列末尾
    this.order = this.order.filter((p) => p !== pageNum)
    this.order.push(pageNum)
    return entry.canvas
  }

  /**
   * 将已渲染的页面位图缓存为离屏副本。
   * @param source 已经渲染好内容的 DOM canvas
   */
  set(pageNum: number, source: HTMLCanvasElement): void {
    const pixels = source.width * source.height
    let entry = this.cache.get(pageNum)

    // 尺寸变化（缩放/分辨率调整）则重建离屏副本
    if (!entry || entry.canvas.width !== source.width || entry.canvas.height !== source.height) {
      if (entry) {
        this.totalPixels -= entry.pixels
        this.cache.delete(pageNum)
        this.order = this.order.filter((p) => p !== pageNum)
      }
      const off = document.createElement('canvas')
      off.width = source.width
      off.height = source.height
      entry = { canvas: off, pageNum, pixels }
    }

    const ctx = entry.canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, entry.canvas.width, entry.canvas.height)
      ctx.drawImage(source, 0, 0)
    }

    this.totalPixels += entry.pixels
    this.cache.set(pageNum, entry)
    this.order = this.order.filter((p) => p !== pageNum)
    this.order.push(pageNum)

    this.evict()
  }

  /** 超过容量或像素预算时淘汰最久未用的离屏副本 */
  private evict(): void {
    while (
      (this.cache.size > PDF_CACHE_CAPACITY || this.totalPixels > PDF_MAX_CACHE_PIXELS) &&
      this.order.length > 0
    ) {
      const oldest = this.order.shift()!
      const entry = this.cache.get(oldest)
      if (entry) {
        this.totalPixels -= entry.pixels
        entry.canvas.width = 0
        entry.canvas.height = 0
        this.cache.delete(oldest)
      }
    }
  }

  clear(): void {
    for (const [, entry] of this.cache) {
      entry.canvas.width = 0
      entry.canvas.height = 0
    }
    this.cache.clear()
    this.order = []
    this.totalPixels = 0
  }

  size(): number {
    return this.cache.size
  }
}
