/**
 * PDF 阅读器 — 容器组件
 *
 * O-01 优化：
 * - 分阶段加载（Stage A：立即显示 toolbar；Stage B/C 后台异步）
 * - 懒加载页面尺寸（usePageDimensions）
 * - DOM 窗口化（只渲染可见页，scrollTop 驱动）
 * - 渲染优先级队列（PdfRenderQueue）
 * - Canvas devicePixelRatio 适配
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { usePdfStore } from '../../stores/pdf.store'
import { pdfService } from '../../services/pdf.service'
import { bindingService } from '../../services/binding.service'
import { PdfJsEngine } from './engine/PdfJsEngine'
import { PageCache } from './pageCache'
import { PdfRenderQueue, RenderPriority } from './renderQueue'
import { useVirtualPages } from './useVirtualPages'
import { usePageDimensions } from './usePageDimensions'
import PdfToolbar from './PdfToolbar'
import BookmarkPanel from './BookmarkPanel'
import BoundNotesPanel from './BoundNotesPanel'
import CreateNoteDialog from './CreateNoteDialog'
import PdfFindBar from './PdfFindBar'
import type { PdfEngine } from './engine/PdfEngine'
import type { Annotation } from '../../../shared/types'

const PAGE_GAP = 16

const PdfViewer: React.FC = () => {
  const dock = useWorkspaceStore((s) => s.dock)
  const pdfPath = dock && 'pdfPath' in dock ? dock.pdfPath : null
  const page = dock && 'page' in dock ? dock.page : 1
  const setPage = useWorkspaceStore((s) => s.setPage)

  const pdf = usePdfStore()
  const openSplit = useWorkspaceStore((s) => s.openSplit)
  const engineRef = useRef<PdfEngine | null>(null)
  const cacheRef = useRef(new PageCache())
  const renderQueueRef = useRef(new PdfRenderQueue(2))
  const scrollRef = useRef<HTMLDivElement>(null)
  /** 用户主动跳页标记 */
  const userJumpRef = useRef(false)
  const initialJumpDoneRef = useRef(false)

  const [pageCount, setPageCount] = useState(0)
  const [, forceUpdate] = useState(0)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [sidePanelOpen, setSidePanelOpen] = useState(true)
  const [showFind, setShowFind] = useState(false)
  const [boundNotesOpen, setBoundNotesOpen] = useState(true)
  const [annotationsOpen, setAnnotationsOpen] = useState(true)

  /** targetPage：优先 dock 指定页，其次 meta.lastPage，最后第 1 页 */
  const targetPageRef = useRef(1)

  // ── 懒加载尺寸 Hook ───────────────────────
  const { dims, ensureDim, estimateHeight, preloadRange } = usePageDimensions(
    engineRef.current,
    pageCount,
    targetPageRef.current
  )

  // ── 计算 getPageTop / getPageHeight ──────────
  const getPageTop = useCallback(
    (pageNum: number): number => {
      let offset = 0
      for (let i = 1; i < pageNum; i++) {
        offset += estimateHeight(i, pdf.scale) + PAGE_GAP
      }
      return offset
    },
    [estimateHeight, pdf.scale]
  )

  const getPageHeight = useCallback(
    (pageNum: number): number => {
      const d = dims[pageNum - 1]
      if (d) return Math.ceil(d.height * pdf.scale)
      return estimateHeight(pageNum, pdf.scale)
    },
    [dims, estimateHeight, pdf.scale]
  )

  const totalHeight = (() => {
    let sum = 0
    for (let i = 1; i <= pageCount; i++) {
      sum += getPageHeight(i) + PAGE_GAP
    }
    return sum
  })()

  // ── 虚拟化 ───────────────────────────────────
  const { visibleRange } = useVirtualPages({
    pageCount,
    scrollRef,
    getPageTop,
    getPageHeight
  })

  // ════════════════════════════════════════════
  // Stage A: 打开 PDF → 立即显示 toolbar
  // Stage B: 并行获取 meta + boundNotes
  // Stage C: 后台懒加载页面尺寸
  // ════════════════════════════════════════════

  useEffect(() => {
    if (!pdfPath) return
    // pdfPath 未变且 engine 仍存活 → 跳过
    if (pdfPath === pdf.pdfPath && engineRef.current) return

    // 确定目标页
    const targetPage = (page > 1 ? page : 0) || 1
    targetPageRef.current = targetPage

    pdf.setLoading(true)
    initialJumpDoneRef.current = false
    cacheRef.current.clear()
    renderQueueRef.current.clear()
    setPageCount(0)

    ;(async () => {
      // Stage A（阻塞最短）：读取 buffer → engine.open → 得到 pageCount
      const buf = await pdfService.readBuffer(pdfPath)
      const engine = new PdfJsEngine()
      await engine.open(buf)
      engineRef.current = engine

      const count = engine.getPageCount()
      setPageCount(count)

      // 预加载目标页尺寸（首屏立即需要）
      if (targetPage <= count) {
        ensureDim(targetPage).catch(() => {})
        if (targetPage > 1) ensureDim(targetPage - 1).catch(() => {})
        if (targetPage < count) ensureDim(targetPage + 1).catch(() => {})
      }

      // Stage A 完成 → 立即显示 UI（占位 meta，Stage B 再更新）
      const placeholderMeta = {
        version: 3,
        file: pdfPath.split('/').pop() ?? 'unknown.pdf',
        bookmarks: [],
        lastPage: targetPage,
        boundNotes: [],
        annotations: [],
        updatedAt: new Date().toISOString()
      }
      pdf.open(pdfPath, placeholderMeta, [])
      pdf.setLoading(false)

      // 初始跳转目标页
      userJumpRef.current = true
      setPage(targetPage)
      forceUpdate((n) => n + 1)

      // Stage B（后台）：并行获取 meta + boundNotes
      const [meta, bns] = await Promise.all([
        pdfService.getMeta(pdfPath).catch(() => null),
        bindingService.listBoundNotes(pdfPath).catch(() => [])
      ])

      if (meta && pdfPath === pdf.pdfPath) {
        pdf.setMeta(meta)
        pdf.setBoundNotes(bns)
        // 最后修正 targetPage（meta.lastPage 可能更精确）
        const finalTarget = (page > 1 ? page : 0) || (meta.lastPage > 0 ? meta.lastPage : 0) || targetPage
        if (finalTarget !== targetPage && finalTarget <= count) {
          userJumpRef.current = true
          setPage(finalTarget)
        }
      }

      // Stage C（后台）：懒加载可见范围尺寸
      preloadRange(1, Math.min(count, 10))
    })()

    return () => {
      engineRef.current?.close()
      cacheRef.current.clear()
      renderQueueRef.current.clear()
      engineRef.current = null
    }
  }, [pdfPath, pdf.pdfPath])

  // ── 用户主动跳页 → 滚动 ──────────────────

  useEffect(() => {
    if (!userJumpRef.current) return
    if (!scrollRef.current || !pageCount) return

    // 用 requestAnimationFrame 等待虚拟化挂载
    const raf = requestAnimationFrame(() => {
      const targetTop = getPageTop(page)
      scrollRef.current?.scrollTo({ top: targetTop, behavior: 'instant' })
      userJumpRef.current = false
      initialJumpDoneRef.current = true
      // 预加载可见范围尺寸
      preloadRange(visibleRange.start, visibleRange.end)
    })
    return () => cancelAnimationFrame(raf)
  }, [page, pageCount, getPageTop, visibleRange, preloadRange])

  /** 用户主动跳页 */
  const jumpToPage = useCallback(
    (n: number) => {
      userJumpRef.current = true
      setPage(n)
      ensureDim(n).catch(() => {})
    },
    [setPage, ensureDim]
  )

  // ── 缩放变化 → 清缓存 ────────────────────

  useEffect(() => {
    cacheRef.current.clear()
    renderQueueRef.current.clear()
    forceUpdate((n) => n + 1)
  }, [pdf.scale])

  // ── lastPage 防抖落盘 ────────────────────

  useEffect(() => {
    if (!pdfPath || page <= 0) return
    const timer = setTimeout(() => {
      pdfService.updateMeta(pdfPath, { lastPage: page }).catch(() => {})
    }, 2000)
    return () => clearTimeout(timer)
  }, [page, pdfPath])

  // ── 创建绑定笔记 ────────────────────────

  const handleCreateNote = async (name: string) => {
    setShowCreateDialog(false)
    try {
      const noteRel = await bindingService.createBoundNote(pdfPath!, {
        name: name.endsWith('.md') ? name : name + '.md'
      })
      const bns = await bindingService.listBoundNotes(pdfPath!)
      pdf.setBoundNotes(bns)
      openSplit(pdfPath!, noteRel, { page })
    } catch {
      // ignore
    }
  }

  const defaultNoteName = `《${pdfPath?.split('/').pop()?.replace('.pdf', '') ?? 'PDF'}》笔记 ${(pdf.boundNotes?.length ?? 0) + 1}`

  // ── 渲染 ────────────────────────────────────

  if (!pdfPath) {
    return <div style={styles.empty}>打开一个 PDF 开始阅读</div>
  }

  // loading 仅表示 engine 尚未 open（极短），期间仍显示 toolbar 骨架
  if (pdf.loading || pageCount === 0) {
    return (
      <div style={styles.container}>
        <PdfToolbar
          page={1}
          pageCount={0}
          scale={1}
          onPageChange={() => {}}
          onScaleChange={() => {}}
          onCreateNote={() => {}}
          sidePanelOpen={sidePanelOpen}
          onToggleSidePanel={() => setSidePanelOpen(!sidePanelOpen)}
          onToggleFind={() => {}}
          isSplit={dock?.mode === 'split'}
          onCollapseNote={() => useWorkspaceStore.getState().closeNote()}
        />
        <div style={{ ...styles.empty, flex: 1 }}>加载中...</div>
      </div>
    )
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
        <PdfFindBar
          engine={engineRef.current}
          pageCount={pageCount}
          onClose={() => setShowFind(false)}
        />
      )}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div
          ref={scrollRef}
          style={{ ...styles.scroller, flex: 1 }}
          onScroll={() => {
            const el = scrollRef.current
            if (!el || pageCount === 0) return
            const scrollTop = el.scrollTop
            const viewportTop = el.getBoundingClientRect().top
            const targetY = viewportTop + el.clientHeight * 0.3

            let bestPage = 1
            for (let i = 1; i <= pageCount; i++) {
              const pageTop = getPageTop(i)
              const screenTop = el.offsetTop + pageTop - scrollTop
              if (screenTop <= targetY) {
                bestPage = i
              } else {
                break
              }
            }
            if (bestPage !== page) setPage(bestPage)

            // 滚动时预加载尺寸
            preloadRange(visibleRange.start, visibleRange.end)
          }}
        >
          {/* 总高度占位容器 */}
          <div style={{ height: totalHeight, position: 'relative' }}>
            {Array.from({ length: visibleRange.end - visibleRange.start + 1 }, (_, i) => {
              const pageNum = visibleRange.start + i
              const dim = dims[pageNum - 1]
              const pageHeight = getPageHeight(pageNum)
              const offsetTop = getPageTop(pageNum)

              return (
                <div
                  key={pageNum}
                  data-page={pageNum}
                  style={{
                    position: 'absolute',
                    top: offsetTop,
                    left: 0,
                    right: 0,
                    height: pageHeight + PAGE_GAP,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-start'
                  }}
                >
                  {dim ? (
                    <PageCanvas
                      pageNum={pageNum}
                      engine={engineRef.current}
                      cache={cacheRef.current}
                      renderQueue={renderQueueRef.current}
                      scale={pdf.scale}
                      pageWidth={Math.ceil(dim.width * pdf.scale)}
                      pageHeight={pageHeight}
                      priority={
                        pageNum === page
                          ? RenderPriority.Current
                          : Math.abs(pageNum - page) === 1
                            ? RenderPriority.Adjacent
                            : RenderPriority.Visible
                      }
                    />
                  ) : (
                    /* 尺寸未就绪 → 灰色骨架占位 */
                    <div
                      style={{
                        width: '70%',
                        height: pageHeight,
                        backgroundColor: 'var(--bg-tertiary)',
                        borderRadius: 2,
                        opacity: 0.3
                      }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 标注侧栏（可折叠） */}
        {sidePanelOpen && (
          <div style={styles.sidePanel}>
            <div style={styles.sideTitle}>书签</div>
            <BookmarkPanel
              pdfPath={pdfPath}
              engine={engineRef.current}
              bookmarks={pdf.meta?.bookmarks ?? []}
              currentPage={page}
              onJump={jumpToPage}
              onBookmarksChange={(bookmarks) => {
                if (pdf.meta) {
                  pdf.setMeta({ ...pdf.meta, bookmarks })
                }
              }}
            />

            <div
              style={{
                ...styles.sideTitle,
                marginTop: 12,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between'
              }}
              onClick={() => setBoundNotesOpen(!boundNotesOpen)}
            >
              <span>关联笔记</span>
              <span>{boundNotesOpen ? '▾' : '▸'}</span>
            </div>
            {boundNotesOpen && <BoundNotesPanel pdfPath={pdfPath} />}

            <div
              style={{
                ...styles.sideTitle,
                marginTop: 12,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between'
              }}
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
                      backgroundColor:
                        pdf.selectedAnnotationId === ann.id
                          ? 'var(--bg-active)'
                          : 'transparent'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          backgroundColor: ann.color,
                          flexShrink: 0
                        }}
                      />
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        p.{ann.page}
                      </span>
                    </div>
                    {ann.comment && (
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-secondary)',
                          marginTop: 2
                        }}
                      >
                        {ann.comment}
                      </div>
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

// ── 单页 Canvas 组件（使用渲染队列 + devicePixelRatio 适配） ─────

const PageCanvas: React.FC<{
  pageNum: number
  engine: PdfEngine | null
  cache: PageCache
  renderQueue: PdfRenderQueue
  scale: number
  pageWidth: number
  pageHeight: number
  priority: number
}> = React.memo(
  ({ pageNum, engine, cache, renderQueue, scale, pageWidth, pageHeight, priority }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const renderedKeyRef = useRef(0) // 用于判断是否需要重渲染

    useEffect(() => {
      if (!engine || !canvasRef.current) return

      const canvas = canvasRef.current
      const renderKey = scale * 1000 + pageNum
      if (renderedKeyRef.current === renderKey) {
        // 同 scale+pageNum 已有缓存 → 快速恢复
        const cached = cache.get(pageNum)
        if (cached && cached !== canvas) {
          const ctx = canvas.getContext('2d')
          if (ctx) {
            canvas.width = cached.width
            canvas.height = cached.height
            ctx.drawImage(cached, 0, 0)
          }
        }
        return
      }

      let cancelled = false

      renderQueue.enqueue(pageNum, priority, async () => {
        if (cancelled) return
        const result = await engine.getPage(pageNum).catch(() => null)
        if (cancelled || !result) return

        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const scaledW = Math.floor(pageWidth * dpr)
        const scaledH = Math.floor(pageHeight * dpr)

        // 单页像素上限保护
        if (scaledW * scaledH > 16_000_000) {
          // 超出上限，降 DPR
          const safeDpr = Math.sqrt(16_000_000 / (pageWidth * pageHeight))
          const safeW = Math.floor(pageWidth * safeDpr)
          const safeH = Math.floor(pageHeight * safeDpr)
          canvas.width = safeW
          canvas.height = safeH
          canvas.style.width = `${pageWidth}px`
          canvas.style.height = `${pageHeight}px`
          await result.renderTo(canvas, scale * safeDpr)
        } else {
          canvas.width = Math.floor(pageWidth * dpr)
          canvas.height = Math.floor(pageHeight * dpr)
          canvas.style.width = `${pageWidth}px`
          canvas.style.height = `${pageHeight}px`
          // 用物理像素渲染：scale * dpr 确保高 DPI 屏清晰
          const tempCanvas = document.createElement('canvas')
          await result.renderTo(tempCanvas, scale * dpr)
          canvas.width = tempCanvas.width
          canvas.height = tempCanvas.height
          canvas.style.width = `${Math.floor(tempCanvas.width / dpr)}px`
          canvas.style.height = `${Math.floor(tempCanvas.height / dpr)}px`
          const ctx2 = canvas.getContext('2d')
          if (ctx2) ctx2.drawImage(tempCanvas, 0, 0)
        }

        if (!cancelled) {
          cache.set(pageNum, canvas)
          renderedKeyRef.current = renderKey
        }
      })

      return () => {
        cancelled = true
        renderQueue.cancel(pageNum)
      }
    }, [engine, pageNum, scale, pageWidth, pageHeight, priority, cache, renderQueue])

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
  }
)

// ── 样式 ──────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100%' },
  scroller: {
    overflow: 'auto',
    padding: '16px 0',
    backgroundColor: 'var(--bg-tertiary)'
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    fontSize: 14,
    color: 'var(--text-tertiary)'
  },
  sidePanel: {
    width: 200,
    minWidth: 160,
    backgroundColor: 'var(--bg-secondary)',
    borderLeft: '1px solid var(--border-primary)',
    overflowY: 'auto',
    flexShrink: 0
  },
  sideTitle: {
    padding: '8px 12px',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    borderBottom: '1px solid var(--border-secondary)'
  },
  annList: { padding: '4px 0' },
  annItem: {
    padding: '6px 12px',
    cursor: 'pointer',
    borderBottom: '1px solid var(--border-secondary)'
  }
}

export default PdfViewer
