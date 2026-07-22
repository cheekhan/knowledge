/**
 * 坐标系统转换 — 落地红线 R9
 *
 * 标注存储使用归一化坐标（0~1 相对于页面宽高），
 * 渲染与交互时转换为屏幕像素坐标。
 *
 * 规则：所有标注坐标转换必须经过本模块，禁止组件内各写换算逻辑。
 */

import type { NormalizedRect } from '../../shared/types'

/** 屏幕矩形（像素） */
export interface ScreenRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * 归一化矩形 → 屏幕像素矩形
 *
 * @param rect 归一化矩形（0~1）
 * @param pageWidth 当前页面渲染宽度（CSS 像素）
 * @param pageHeight 当前页面渲染高度（CSS 像素）
 */
export function normalizedToScreen(
  rect: NormalizedRect,
  pageWidth: number,
  pageHeight: number
): ScreenRect {
  return {
    x: rect.x * pageWidth,
    y: rect.y * pageHeight,
    width: rect.w * pageWidth,
    height: rect.h * pageHeight
  }
}

/**
 * 屏幕像素矩形 → 归一化矩形
 *
 * @param screen 屏幕像素矩形（相对于页面渲染区域）
 * @param pageWidth 当前页面渲染宽度
 * @param pageHeight 当前页面渲染高度
 */
export function screenToNormalized(
  screen: ScreenRect,
  pageWidth: number,
  pageHeight: number
): NormalizedRect {
  if (pageWidth <= 0 || pageHeight <= 0) {
    return { x: 0, y: 0, w: 0, h: 0 }
  }
  return {
    x: Math.max(0, Math.min(1, screen.x / pageWidth)),
    y: Math.max(0, Math.min(1, screen.y / pageHeight)),
    w: Math.max(0, Math.min(1, screen.width / pageWidth)),
    h: Math.max(0, Math.min(1, screen.height / pageHeight))
  }
}

/**
 * 计算两个归一化矩形的交集
 * @returns 交集矩形，不相交返回 null
 */
export function normalizedIntersect(
  a: NormalizedRect,
  b: NormalizedRect
): NormalizedRect | null {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.w, b.x + b.w)
  const y2 = Math.min(a.y + a.h, b.y + b.h)

  if (x2 <= x || y2 <= y) return null

  return { x, y, w: x2 - x, h: y2 - y }
}

/**
 * 判断一个归一化点是否在矩形内
 */
export function normalizedContains(
  rect: NormalizedRect,
  px: number,
  py: number
): boolean {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h
}
