/**
 * PDF 页面渲染优先级队列
 *
 * O-01.4：防止可见页与缓冲页无差别竞争渲染资源，
 * 当前页优先渲染，同页新任务覆盖旧任务。
 */

/** 渲染优先级：数字越小越优先 */
export enum RenderPriority {
  /** 当前页（最高优先级） */
  Current = 0,
  /** 相邻页（±1） */
  Adjacent = 1,
  /** 可见缓冲页 */
  Visible = 2,
  /** 其余页 */
  Other = 3
}

interface QueueTask {
  pageNum: number
  priority: number
  task: () => Promise<void>
  /** 任务取消控制器 */
  abort: AbortController
}

export class PdfRenderQueue {
  private tasks: QueueTask[] = []
  private running = false
  /** 同一时间最多并行渲染数 */
  private concurrency: number

  constructor(concurrency = 2) {
    this.concurrency = concurrency
  }

  /**
   * 入队一个渲染任务
   * @param pageNum 页码（1-based）
   * @param priority 优先级
   * @param task 渲染任务函数
   */
  enqueue(pageNum: number, priority: number, task: () => Promise<void>): void {
    // 同页已有排队或正在执行的任务 → 取消旧任务
    this.cancel(pageNum)

    const abort = new AbortController()
    // 支持外部取消（AbortSignal）
    const wrappedTask = async () => {
      if (abort.signal.aborted) return
      await task()
    }
    this.tasks.push({ pageNum, priority, task: wrappedTask, abort })
    this.tasks.sort((a, b) => a.priority - b.priority)
    this.flush()
  }

  /**
   * 取消指定页码的排队/正在执行的任务
   */
  cancel(pageNum: number): void {
    const idx = this.tasks.findIndex((t) => t.pageNum === pageNum)
    if (idx >= 0) {
      this.tasks[idx].abort.abort()
      this.tasks.splice(idx, 1)
    }
  }

  /** 清空所有任务 */
  clear(): void {
    for (const t of this.tasks) t.abort.abort()
    this.tasks = []
  }

  /** 消费队列（最多 concurrency 个并行） */
  private async flush(): Promise<void> {
    if (this.running || this.tasks.length === 0) return
    this.running = true
    const batch = this.tasks.splice(0, this.concurrency)
    const promises = batch.map(async ({ task, abort }) => {
      try {
        if (!abort.signal.aborted) await task()
      } catch {
        // 渲染失败静默忽略（页面可能已经卸载）
      }
    })
    await Promise.all(promises)
    this.running = false
    if (this.tasks.length > 0) this.flush()
  }
}
