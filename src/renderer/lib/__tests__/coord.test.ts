/**
 * coord 坐标转换测试 — 落地红线 R9
 */

import { describe, it, expect } from 'vitest'
import {
  normalizedToScreen,
  screenToNormalized,
  normalizedIntersect,
  normalizedContains
} from '../../lib/coord'
import type { NormalizedRect } from '../../../shared/types'

describe('normalizedToScreen', () => {
  it('全页矩形 → 屏幕全尺寸', () => {
    const rect: NormalizedRect = { x: 0, y: 0, w: 1, h: 1 }
    const screen = normalizedToScreen(rect, 800, 1000)
    expect(screen.x).toBe(0)
    expect(screen.y).toBe(0)
    expect(screen.width).toBe(800)
    expect(screen.height).toBe(1000)
  })

  it('半页矩形', () => {
    const rect: NormalizedRect = { x: 0.25, y: 0.3, w: 0.5, h: 0.4 }
    const screen = normalizedToScreen(rect, 1000, 2000)
    expect(screen.x).toBe(250)
    expect(screen.y).toBe(600)
    expect(screen.width).toBe(500)
    expect(screen.height).toBe(800)
  })

  it('零点缩放', () => {
    const rect: NormalizedRect = { x: 0, y: 0, w: 0, h: 0 }
    const screen = normalizedToScreen(rect, 500, 500)
    expect(screen.width).toBe(0)
    expect(screen.height).toBe(0)
  })
})

describe('screenToNormalized', () => {
  it('回转为归一化', () => {
    const screen = { x: 250, y: 300, width: 500, height: 400 }
    const norm = screenToNormalized(screen, 1000, 1000)
    expect(norm.x).toBe(0.25)
    expect(norm.y).toBe(0.3)
    expect(norm.w).toBe(0.5)
    expect(norm.h).toBe(0.4)
  })

  it('超出边界被夹持', () => {
    const screen = { x: -10, y: 1100, width: 2000, height: 500 }
    const norm = screenToNormalized(screen, 1000, 1000)
    expect(norm.x).toBe(0)
    expect(norm.y).toBe(1)
    expect(norm.w).toBe(1)
    expect(norm.h).toBe(0.5)
  })

  it('零尺寸页面返回零矩形', () => {
    const norm = screenToNormalized({ x: 100, y: 100, width: 50, height: 50 }, 0, 0)
    expect(norm).toEqual({ x: 0, y: 0, w: 0, h: 0 })
  })

  it('归一化 → 屏幕 → 归一化（往返）', () => {
    const original: NormalizedRect = { x: 0.12, y: 0.3, w: 0.6, h: 0.08 }
    const screen = normalizedToScreen(original, 1200, 1600)
    const restored = screenToNormalized(screen, 1200, 1600)
    expect(restored.x).toBeCloseTo(original.x, 10)
    expect(restored.y).toBeCloseTo(original.y, 10)
    expect(restored.w).toBeCloseTo(original.w, 10)
    expect(restored.h).toBeCloseTo(original.h, 10)
  })
})

describe('normalizedIntersect', () => {
  const a: NormalizedRect = { x: 0.1, y: 0.2, w: 0.5, h: 0.5 }
  const b: NormalizedRect = { x: 0.3, y: 0.1, w: 0.5, h: 0.5 }

  it('两矩形相交返回交集', () => {
    const result = normalizedIntersect(a, b)
    expect(result).toBeDefined()
    expect(result!.x).toBeCloseTo(0.3)
    expect(result!.y).toBeCloseTo(0.2)
    expect(result!.w).toBeCloseTo(0.3)
    expect(result!.h).toBeCloseTo(0.4)
  })

  it('不相交返回 null', () => {
    const far: NormalizedRect = { x: 0.9, y: 0.9, w: 0.1, h: 0.1 }
    expect(normalizedIntersect(a, far)).toBeNull()
  })

  it('包含与被包含 → 返回被包含矩形', () => {
    const big: NormalizedRect = { x: 0, y: 0, w: 1, h: 1 }
    const small: NormalizedRect = { x: 0.2, y: 0.2, w: 0.2, h: 0.2 }
    const r = normalizedIntersect(big, small)
    expect(r).toEqual(small)
  })
})

describe('normalizedContains', () => {
  const rect: NormalizedRect = { x: 0.2, y: 0.3, w: 0.4, h: 0.4 }

  it('内部点返回 true', () => {
    expect(normalizedContains(rect, 0.4, 0.5)).toBe(true)
  })

  it('外部点返回 false', () => {
    expect(normalizedContains(rect, 0.1, 0.5)).toBe(false)
    expect(normalizedContains(rect, 0.5, 0.1)).toBe(false)
  })

  it('边界点返回 true', () => {
    expect(normalizedContains(rect, 0.2, 0.3)).toBe(true)
    expect(normalizedContains(rect, 0.6, 0.7)).toBe(true)
  })
})
