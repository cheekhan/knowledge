import { describe, it, expect, beforeEach } from 'vitest'
import { PageCache } from '../pageCache'

describe('PageCache', () => {
  let cache: PageCache
  const c = () => { const el = document.createElement('canvas'); el.width = 100; return el }

  beforeEach(() => { cache = new PageCache() })

  it('初始 size=0', () => { expect(cache.size()).toBe(0) })
  it('get 不存在返回 null', () => { expect(cache.get(1)).toBeNull() })
  it('set 后可 get', () => { const a = c(); cache.set(1, a); expect(cache.get(1)).toBe(a) })

  it('超容量淘汰最旧', () => {
    for (let i = 1; i <= 51; i++) cache.set(i, c())
    expect(cache.size()).toBe(50)
    expect(cache.get(1)).toBeNull()
  })

  it('LRU: 访问过的保留', () => {
    for (let i = 1; i <= 50; i++) cache.set(i, c())
    cache.get(1); cache.set(51, c())
    expect(cache.get(1)).not.toBeNull()
    expect(cache.get(2)).toBeNull()
  })

  it('clear 清空', () => { cache.set(1, c()); cache.clear(); expect(cache.size()).toBe(0) })
  it('同页覆盖不增', () => { cache.set(1, c()); cache.set(1, c()); expect(cache.size()).toBe(1) })
})
