import * as pdfjsLib from 'pdfjs-dist'
import type { PdfEngine, PageRenderResult, PageDimension, OutlineItem } from './PdfEngine'

pdfjsLib.GlobalWorkerOptions.workerSrc =
  new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

export class PdfJsEngine implements PdfEngine {
  private doc: pdfjsLib.PDFDocumentProxy | null = null

  async open(buffer: ArrayBuffer): Promise<void> {
    if (this.doc) this.close()
    this.doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
  }

  getPageCount(): number { return this.doc?.numPages ?? 0 }

  async getPage(num: number): Promise<PageRenderResult> {
    if (!this.doc) throw new Error('Engine not opened')
    const page = await this.doc.getPage(num)
    const vp = page.getViewport({ scale: 1 })
    return {
      viewportWidth: vp.width, viewportHeight: vp.height,
      renderTo: async (canvas: HTMLCanvasElement, scale: number) => {
        const svp = page.getViewport({ scale })
        canvas.width = Math.floor(svp.width)
        canvas.height = Math.floor(svp.height)
        const ctx = canvas.getContext('2d')
        if (ctx) {
          await page.render({
            canvasContext: ctx,
            viewport: svp,
            canvas
          } as Parameters<typeof page.render>[0]).promise
        }
      },
      getTextItems: () => null
    }
  }

  /** 获取单页原始尺寸（scale=1），用于懒加载；不触发渲染 */
  async getPageDimension(num: number): Promise<PageDimension> {
    if (!this.doc) throw new Error('Engine not opened')
    const page = await this.doc.getPage(num)
    const vp = page.getViewport({ scale: 1 })
    return { width: vp.width, height: vp.height }
  }

  async getPageDimensions(): Promise<PageDimension[]> {
    if (!this.doc) return []
    const dims: PageDimension[] = []
    for (let i = 1; i <= this.doc.numPages; i++) {
      const page = await this.doc.getPage(i)
      const vp = page.getViewport({ scale: 1 })
      dims.push({ width: vp.width, height: vp.height })
    }
    return dims
  }

  async getOutline(): Promise<OutlineItem[]> {
    if (!this.doc) return []
    try {
      const out = await this.doc.getOutline()
      if (!out) return []
      return Promise.all(out.map((item) => this.resolveOutlineItem(item)))
    } catch { return [] }
  }

  /** 递归解析 Outline 节点，正确解析 dest → page number */
  private async resolveOutlineItem(item: unknown): Promise<OutlineItem> {
    const node = item as Record<string, unknown>
    let page = 1

    if (node.dest) {
      let dest: unknown = node.dest
      // pdfjs dest 可能是 string（命名目标）或数组 [pageRef, ...]
      if (typeof dest === 'string') {
        try {
          dest = await this.doc!.getDestination(dest)
        } catch { dest = null }
      }
      if (Array.isArray(dest) && dest.length > 0) {
        const pageRef = dest[0]
        try {
          // getPageIndex 返回 0-based index
          page = (await this.doc!.getPageIndex(pageRef)) + 1
        } catch { /* keep page=1 */ }
      }
    }

    const children = node.items
      ? await Promise.all(
        (node.items as unknown[]).map((c) => this.resolveOutlineItem(c))
      )
      : undefined

    return {
      title: (node.title as string) || '未命名',
      page,
      children
    }
  }

  close(): void { this.doc?.cleanup(); this.doc = null }
}
