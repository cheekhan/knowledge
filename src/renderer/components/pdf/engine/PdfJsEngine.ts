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
      return out ? out.map(conv) : []
    } catch { return [] }
  }

  close(): void { this.doc?.cleanup(); this.doc = null }
}

function conv(n: Record<string, unknown>): OutlineItem {
  return {
    title: (n.title as string) || '',
    page: typeof n.dest === 'number' ? n.dest as number : 1,
    children: (n.items as Record<string, unknown>[] | undefined)?.map(conv)
  }
}
