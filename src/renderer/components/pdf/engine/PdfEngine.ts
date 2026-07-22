/**
 * PdfEngine 抽象接口 — 渲染引擎可替换
 *
 * P-08：pdfjs-dist 实现
 * 未来：可替换为 PDFium WASM 后备
 */

export interface PageRenderResult {
  viewportWidth: number
  viewportHeight: number
  renderTo(canvas: HTMLCanvasElement, scale: number): Promise<void>
  getTextItems(): TextItem[] | null
}

/** 单页尺寸（scale=1 时的原始视口宽高），用于占位与虚拟化计算 */
export interface PageDimension {
  width: number
  height: number
}

export interface TextItem {
  text: string
  /** 归一化坐标 */
  x: number; y: number; w: number; h: number
  pageWidth: number; pageHeight: number
}

export interface OutlineItem {
  title: string
  page: number
  children?: OutlineItem[]
}

export interface PdfEngine {
  open(buffer: ArrayBuffer): Promise<void>
  getPageCount(): number
  getPage(num: number): Promise<PageRenderResult>
  /** 获取单页原始尺寸（scale=1），不触发渲染 */
  getPageDimension(num: number): Promise<PageDimension>
  /** 批量获取所有页面的原始尺寸（scale=1），用于占位高度与虚拟化，不触发渲染 */
  getPageDimensions(): Promise<PageDimension[]>
  getOutline(): Promise<OutlineItem[]>
  close(): void
}
