/**
 * PDF 阅读器 — 容器组件
 *
 * P-10：绑定面板 + 创建笔记对话框 + lastPage 持久化
 * 修复：虚拟化渲染（只渲染视口±2页）+ 页面占位高度 + 正确的初始页跳转 + lastPage 恢复
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { usePdfStore } from '../../stores/pdf.store'
import { pdfService } from '../../services/pdf.service'
import { bindingService } from '../../services/binding.service'
import { PdfJsEngine } from './engine/PdfJsEngine'
import { PageCache } from './pageCache'
import { useVirtualPages } from './useVirtualPages'
import PdfToolbar from './PdfToolbar'
import TagInput from '../tags/TagInput'
import BoundNotesPanel from './BoundNotesPanel'
import CreateNoteDialog from './CreateNoteDialog'
import PdfFindBar from './PdfFindBar'
import type { PdfEngine, PageDimension } from './engine/PdfEngine'
import type { Annotation } from '../../../shared/types'

const PdfViewer: React.FC = () => {
  const dock = useWorkspaceStore((s) => s.dock)
  const pdfPath = dock && 'pdfPath' in dock ? dock.pdfPath : null
  const page = dock && 'page' in dock ? dock.page : 1
  const setPage = useWorkspaceStore((s) => s.setPage)

  const pdf = usePdfStore()
  const openSplit = useWorkspaceStore((s) => s.openSplit)
  const engineRef = useRef<PdfEngine | null>(null)
  const cacheRef = useRef(new PageCache())
  const scrollRef = useRef<HTMLDivElement>(null)
  /** 用户主动跳页标记：true 时才执行 scrollIntoView；滚动自然推进页码时不触发 */
  const userJumpRef = useRef(false)
  /** 初始跳页是否已执行（避免重复跳转） */
  const initialJumpDoneRef = useRef(false)

  const [pageCount, setPageCount] = useState(0)
  const [pageDimensions, setPageDimensions] = useState<PageDimension[]>([])
  const [, forceUpdate] = useState(0)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [sidePanelOpen, setSidePanelOpen] = useState(true)
  const [showFind, setShowFind] = useState(false)
  const [boundNotesOpen, setBoundNotesOpen] = useState(true)
  const [annotationsOpen, setAnnotationsOpen] = useState(true)

  // ── 虚拟化 ───────────────────────────────────
  const { visibleRange, registerPage } = useVirtualPages({
    pageCount,
    scrollRef
  })

  // ── 打开 PDF ────────────────────────────────

  useEffect(() => {
    if (!pdfPath) return
    // pdfPath 未变且 engine 仍在内存中 → 跳过重建（避免分屏切换时重复加载）
    if (pdfPath === pdf.pdfPath && engineRef.current) return

    pdf.setLoading(true)
    initialJumpDoneRef.current = false
    const cache = cacheRef.current
    cache.clear()

    ;(async () => {
      const buf = await pdfService.readBuffer(pdfPath)
      const engine = new PdfJsEngine()
      await engine.open(buf)
      engineRef.current = engine

      const meta = await pdfService.getMeta(pdfPath)
      const bns = await bindingService.listBoundNotes(pdfPath).catch(() => [])
      pdf.open(pdfPath, meta, bns)
      setPageCount(engine.getPageCount())

      // 批量获取所有页面尺寸（不触发渲染，仅 viewport，快速）
      const dims = await engine.getPageDimensions()
      setPageDimensions(dims)

      // 恢复阅读位置：优先 dock 指定页，其次 sidecar lastPage (FR-4.4)，最后第 1 页
      const targetPage = (page > 1 ? page : 0) || (meta.lastPage > 0 ? meta.lastPage : 0) || 1
      userJumpRef.current = true
      setPage(targetPage)
      forceUpdate((n) => n + 1)
      pdf.setLoading(false)
    })()

    return () => {
      engineRef.current?.close()
      cache.clear()
      engineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfPath])

  // ── 用户主动跳页时滚动到对应页 ──────────────

  useEffect(() => {
    if (!userJumpRef.current) return  // 滚动自然推进的页码不触发
    if (!scrollRef.current || !pageCount) return
    if (pageDimensions.length === 0) return  // 等待尺寸就绪

    const pageEl = scrollRef.current.querySelector(`[data-page="${page}"]`)
    if (!pageEl) {
      // 页面元素可能尚未挂载（虚拟化），延迟重试
      const timer = setTimeout(() => {
        userJumpRef.current = false
      }, 300)
      return () => clearTimeout(timer)
    }

    pageEl.scrollIntoView({ block: 'start' })
    userJumpRef.current = false
    initialJumpDoneRef.current = true
  }, [page, pageCount, pageDimensions])

  /** 用户主动跳页（按钮/标注/输入框） */
  const jumpToPage = useCallback((n: number) => {
    userJumpRef.current = true
    setPage(n)
  }, [setPage])

  // ── 缩放变化 → 清缓存重渲染 ────────────────

  useEffect(() => {
    cacheRef.current.clear()
    forceUpdate((n) => n + 1)
  }, [pdf.scale])

  // ── lastPage 防抖落盘 ──────────────────────

  useEffect(() => {
    if (!pdfPath || page <= 0) return
    const timer = setTimeout(() => {
      pdfService.updateMeta(pdfPath, { lastPage: page }).catch(() => {})
    }, 2000)
    return () => clearTimeout(timer)
  }, [page, pdfPath])

  // ── 创建绑定笔记 ────────────────────────────

  const handleCreateNote = async (name: string) => {
    setShowCreateDialog(false)
    try {
      const noteRel = await bindingService.createBoundNote(pdfPath!, { name: name.endsWith('.md') ? name : name + '.md' })
      // 刷新绑定列表
      const bns = await bindingService.listBoundNotes(pdfPath!)
      pdf.setBoundNotes(bns)
      // 进入分屏
      openSplit(pdfPath!, noteRel, { page })
    } catch {
      // P-12 提示错误
    }
  }

  // 默认笔记名
  const defaultNoteName = `《${pdfPath?.split('/').pop()?.replace('.pdf','') ?? 'PDF'}》笔记 ${(pdf.boundNotes?.length ?? 0) + 1}`

  // ── 计算占位总高度，确保滚动条正确 ──────────

  const pageGap = 16 // PageCanvas marginBottom
  const totalHeight = pageDimensions.reduce((sum, dim) => {
    return sum + Math.ceil(dim.height * pdf.scale) + pageGap
  }, 0)

  // 计算目标页之前所有页面的累计高度（用于精确滚动定位）
  const getOffsetTop = useCallback((targetPage: number): number => {
    let offset = 0
    for (let i = 0; i < targetPage - 1 && i < pageDimensions.length; i++) {
      offset += Math.ceil(pageDimensions[i].height * pdf.scale) + pageGap
    }
    return offset
  }, [pageDimensions, pdf.scale])

  // ── 渲染 ────────────────────────────────────

  if (!pdfPath) {
    return <div style={styles.empty}>打开一个 PDF 开始阅读</div>
  }

  if (pdf.loading) {
    return <div style={styles.empty}>加载中…</div>
  }

  return (
    <div style={styles.container}>
      <PdfToolbar
        page={page}
        pageCount={pageCount}
        scale={pdf.scale}
        onPageChange={jumpToPage}
        onScaleChange={pdf.setScale}
        onCreateNote={() => setShowCreateDialog(true)}
        sidePanelOpen={sidePanelOpen}
        onToggleSidePanel={() => setSidePanelOpen(!sidePanelOpen)}
        onToggleFind={() => setShowFind(!showFind)}
        isSplit={dock?.mode === 'split'}
        onCollapseNote={() => useWorkspaceStore.getState().closeNote()}
      />
      {showFind && engineRef.current && (
        <PdfFindBar engine={engineRef.current} pageCount={pageCount} onClose={() => setShowFind(false)} />
      )}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div
          ref={scrollRef}
          style={{ ...styles.scroller, flex: 1 }}
          onScroll={() => {
            const el = scrollRef.current
            if (!el || pageDimensions.length === 0) return
            // 基于滚动位置精确计算当前页码（使用占位高度，无需依赖已渲染的 DOM）
            const scrollTop = el.scrollTop
            const viewportTop = el.getBoundingClientRect().top
            // 视口 30% 处作为"当前页"判定线
            const targetY = viewportTop + el.clientHeight * 0.3

            let accumulated = 0
            let bestPage = 1
            for (let i = 0; i < pageDimensions.length; i++) {
              const pageHeight = Math.ceil(pageDimensions[i].height * pdf.scale) + pageGap
              const pageTop = accumulated
              const pageBottom = accumulated + pageHeight
              // 转为屏幕坐标：页面顶部相对视口的位置
              const screenTop = el.offsetTop + pageTop - scrollTop
              const screenBottom = screenTop + pageHeight
              if (screenTop <= targetY) {
                bestPage = i + 1
              }
              accumulated = pageBottom
            }
            // 滚动自然推进页码，不触发 scrollIntoView
            if (bestPage !== page) setPage(bestPage)
          }}
        >
          {/* 总高度占位容器：确保滚动条正确 */}
          <div style={{ height: totalHeight, position: 'relative' }}>
            {Array.from({ length: pageCount }, (_, i) => {
              const pageNum = i + 1
              const dim = pageDimensions[i]
              const pageHeight = dim ? Math.ceil(dim.height * pdf.scale) : 0
              const offsetTop = getOffsetTop(pageNum)

              // 虚拟化：只渲染可见范围内的页面
              const isVisible = pageNum >= visibleRange.start && pageNum <= visibleRange.end

              return (
                <div
                  key={pageNum}
                  data-page={pageNum}
                  ref={(el) => registerPage(pageNum, el)}
                  style={{
                    position: 'absolute',
                    top: offsetTop,
                    left: 0,
                    right: 0,
                    height: pageHeight + pageGap,
                    display: 'flex',
                    justifyContent: 'center'
                  }}
                >
                  {isVisible && dim ? (
                    <PageCanvas
                      pageNum={pageNum}
                      engine={engineRef.current}
                      cache={cacheRef.current}
                      scale={pdf.scale}
                      pageWidth={Math.ceil(dim.width * pdf.scale)}
                      pageHeight={pageHeight}
                    />
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>

        {/* 标注侧栏（可折叠） */}
        {sidePanelOpen && (
        <div style={styles.sidePanel}>
          <div style={styles.sideTitle}>标签</div>
          <div style={{ padding: '0 8px' }}>
            <TagInput
              tags={pdf.meta?.tags ?? []}
              onChange={async (tags: string[]) => {
                if (!pdf.meta) return
                await pdfService.updateMeta(pdfPath, { tags })
                pdf.setMeta({ ...pdf.meta, tags })
              }}
            />
          </div>

          <div
            style={{ ...styles.sideTitle, marginTop: 12, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
            onClick={() => setBoundNotesOpen(!boundNotesOpen)}
          >
            <span>关联笔记</span>
            <span>{boundNotesOpen ? '▾' : '▸'}</span>
          </div>
          {boundNotesOpen && <BoundNotesPanel pdfPath={pdfPath} />}

          <div
            style={{ ...styles.sideTitle, marginTop: 12, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
            onClick={() => setAnnotationsOpen(!annotationsOpen)}
          >
            <span>标注</span>
            <span>{annotationsOpen ? '▾' : '▸'}</span>
          </div>
          {annotationsOpen && (
          <div style={styles.annList}>
            {(pdf.meta?.annotations ?? []).map((ann: Annotation) => (
              <div
                key={ann.id}
                onClick={() => {
                  pdf.selectAnnotation(ann.id)
                  jumpToPage(ann.page)
                }}
                style={{
                  ...styles.annItem,
                  backgroundColor: pdf.selectedAnnotationId === ann.id ? 'var(--bg-active)' : 'transparent'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: ann.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>p.{ann.page}</span>
                </div>
                {ann.comment && (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{ann.comment}</div>
                )}
              </div>
            ))}
          </div>
          )}
        </div>
        )}
      </div>

      {showCreateDialog && (
        <CreateNoteDialog
          defaultName={defaultNoteName}
          onConfirm={handleCreateNote}
          onCancel={() => setShowCreateDialog(false)}
        />
      )}
    </div>
  )
}

// ── 单页 Canvas 组件 ─────────────────────────────

const PageCanvas: React.FC<{
  pageNum: number
  engine: PdfEngine | null
  cache: PageCache
  scale: number
  pageWidth: number
  pageHeight: number
}> = React.memo(({ pageNum, engine, cache, scale, pageWidth, pageHeight }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderedScaleRef = useRef(0)

  useEffect(() => {
    if (!engine || !canvasRef.current) return
    // 同 scale 已渲染过则跳过（但缓存被清除后需重新渲染）
    if (renderedScaleRef.current === scale) {
      const cached = cache.get(pageNum)
      if (cached) {
        // 使用缓存：把缓存的 canvas 内容复制到当前 canvas
        const ctx = canvasRef.current.getContext('2d')
        if (ctx && cached !== canvasRef.current) {
          canvasRef.current.width = cached.width
          canvasRef.current.height = cached.height
          ctx.drawImage(cached, 0, 0)
        }
        return
      }
    }

    const canvas = canvasRef.current
    let cancelled = false

    engine.getPage(pageNum).then(async (result) => {
      if (cancelled) return
      await result.renderTo(canvas, scale)
      if (cancelled) return
      cache.set(pageNum, canvas)
      renderedScaleRef.current = scale
    })

    return () => { cancelled = true }
  }, [engine, pageNum, scale, cache])

  return (
    <canvas
      ref={canvasRef}
      width={pageWidth}
      height={pageHeight}
      style={{
        width: `${pageWidth}px`,
        height: `${pageHeight}px`,
        boxShadow: '0 1px 6px rgba(0,0,0,0.1)',
        borderRadius: 2
      }}
    />
  )
})

// ── 样式 ──────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100%' },
  scroller: { overflow: 'auto', padding: '16px 0', backgroundColor: 'var(--bg-tertiary)' },
  empty: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 14, color: 'var(--text-tertiary)' },
  sidePanel: { width: 200, minWidth: 160, backgroundColor: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-primary)', overflowY: 'auto', flexShrink: 0 },
  sideTitle: { padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-secondary)' },
  annList: { padding: '4px 0' },
  annItem: { padding: '6px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-secondary)' }
}

export default PdfViewer
