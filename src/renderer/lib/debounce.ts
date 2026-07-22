/**
 * 通用防抖工具
 */

/**
 * 创建一个防抖函数
 * @param fn 需要防抖的函数
 * @param delayMs 延迟毫秒
 * @returns 防抖后的函数（含 cancel 方法）
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delayMs: number
): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null

  const debounced = (...args: Parameters<T>) => {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, delayMs)
  }

  debounced.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  return debounced as T & { cancel: () => void }
}

/**
 * 创建一个限流函数
 * @param fn 需要限流的函数
 * @param intervalMs 最小间隔毫秒
 */
export function throttle<T extends (...args: Parameters<T>) => void>(
  fn: T,
  intervalMs: number
): T {
  let lastTime = 0

  const throttled = (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastTime >= intervalMs) {
      lastTime = now
      fn(...args)
    }
  }

  return throttled as T
}
