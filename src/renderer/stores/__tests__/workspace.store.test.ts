/**
 * workspace.store 状态机测试
 *
 * 覆盖架构 5.1 状态变迁表全部规则
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useWorkspaceStore } from '../workspace.store'

describe('workspaceStore 状态机', () => {
  beforeEach(() => {
    useWorkspaceStore.getState().close()
  })

  // ── 初始化 ─────────────────────────────────

  it('初始无 dock', () => {
    expect(useWorkspaceStore.getState().dock).toBeNull()
  })

  // ── openNote ───────────────────────────────

  it('openNote → mode=note', () => {
    useWorkspaceStore.getState().openNote('notes/a.md')
    const dock = useWorkspaceStore.getState().dock
    expect(dock?.mode).toBe('note')
    if (dock?.mode === 'note') {
      expect(dock.notePath).toBe('notes/a.md')
    }
  })

  // ── openPdf ────────────────────────────────

  it('openPdf → mode=pdf', () => {
    useWorkspaceStore.getState().openPdf('pdfs/book.pdf', 5)
    const dock = useWorkspaceStore.getState().dock
    expect(dock?.mode).toBe('pdf')
    if (dock?.mode === 'pdf') {
      expect(dock.pdfPath).toBe('pdfs/book.pdf')
      expect(dock.page).toBe(5)
    }
  })

  it('openPdf 默认页码为 1', () => {
    useWorkspaceStore.getState().openPdf('pdfs/book.pdf')
    const dock = useWorkspaceStore.getState().dock
    if (dock?.mode === 'pdf') {
      expect(dock.page).toBe(1)
    }
  })

  // ── openSplit ──────────────────────────────

  it('openSplit → mode=split', () => {
    useWorkspaceStore.getState().openSplit('pdfs/a.pdf', 'notes/a.md')
    const dock = useWorkspaceStore.getState().dock
    expect(dock?.mode).toBe('split')
    if (dock?.mode === 'split') {
      expect(dock.pdfPath).toBe('pdfs/a.pdf')
      expect(dock.notePath).toBe('notes/a.md')
      expect(dock.pdfSide).toBe('left')
    }
  })

  it('openSplit 可指定 pdfSide', () => {
    useWorkspaceStore.getState().openSplit('a.pdf', 'a.md', { pdfSide: 'right' })
    const dock = useWorkspaceStore.getState().dock
    if (dock?.mode === 'split') {
      expect(dock.pdfSide).toBe('right')
    }
  })

  // ── split 内部切换 ─────────────────────────

  it('split 中 switchNote 只换笔记', () => {
    useWorkspaceStore.getState().openSplit('pdfs/a.pdf', 'notes/a.md')
    useWorkspaceStore.getState().switchNote('notes/b.md')
    const dock = useWorkspaceStore.getState().dock
    if (dock?.mode === 'split') {
      expect(dock.notePath).toBe('notes/b.md')
      expect(dock.pdfPath).toBe('pdfs/a.pdf') // PDF 不变
    }
  })

  it('非 split 模式 switchNote 无效果', () => {
    useWorkspaceStore.getState().openNote('notes/a.md')
    useWorkspaceStore.getState().switchNote('notes/b.md')
    expect(useWorkspaceStore.getState().dock?.mode).toBe('note')
  })

  // ── 退化 ───────────────────────────────────

  it('split 中 closeNote → mode=pdf', () => {
    useWorkspaceStore.getState().openSplit('pdfs/a.pdf', 'notes/a.md')
    useWorkspaceStore.getState().closeNote()
    expect(useWorkspaceStore.getState().dock?.mode).toBe('pdf')
  })

  it('split 中 closePdf → mode=note', () => {
    useWorkspaceStore.getState().openSplit('pdfs/a.pdf', 'notes/a.md')
    useWorkspaceStore.getState().closePdf()
    expect(useWorkspaceStore.getState().dock?.mode).toBe('note')
  })

  it('note 中 closeNote → null', () => {
    useWorkspaceStore.getState().openNote('notes/a.md')
    useWorkspaceStore.getState().closeNote()
    expect(useWorkspaceStore.getState().dock).toBeNull()
  })

  it('pdf 中 closePdf → null', () => {
    useWorkspaceStore.getState().openPdf('pdfs/a.pdf')
    useWorkspaceStore.getState().closePdf()
    expect(useWorkspaceStore.getState().dock).toBeNull()
  })

  // ── 比例与方向 ─────────────────────────────

  it('setSplitRatio 被夹持在 MIN/MAX 内', () => {
    useWorkspaceStore.getState().openSplit('a.pdf', 'a.md')
    useWorkspaceStore.getState().setSplitRatio(0.1) // below min
    const dock = useWorkspaceStore.getState().dock
    if (dock?.mode === 'split') {
      expect(dock.splitRatio).toBe(0.3) // MIN
    }
  })

  it('togglePdfSide 互换', () => {
    useWorkspaceStore.getState().openSplit('a.pdf', 'a.md')
    expect(
      (useWorkspaceStore.getState().dock as { pdfSide?: string })?.pdfSide
    ).toBe('left')
    useWorkspaceStore.getState().togglePdfSide()
    expect(
      (useWorkspaceStore.getState().dock as { pdfSide?: string })?.pdfSide
    ).toBe('right')
    useWorkspaceStore.getState().togglePdfSide()
    expect(
      (useWorkspaceStore.getState().dock as { pdfSide?: string })?.pdfSide
    ).toBe('left')
  })

  // ── setPage ────────────────────────────────

  it('pdf 模式 setPage', () => {
    useWorkspaceStore.getState().openPdf('a.pdf', 1)
    useWorkspaceStore.getState().setPage(42)
    const dock = useWorkspaceStore.getState().dock
    if (dock?.mode === 'pdf') {
      expect(dock.page).toBe(42)
    }
  })

  it('split 模式 setPage', () => {
    useWorkspaceStore.getState().openSplit('a.pdf', 'a.md')
    useWorkspaceStore.getState().setPage(10)
    const dock = useWorkspaceStore.getState().dock
    if (dock?.mode === 'split') {
      expect(dock.page).toBe(10)
    }
  })

  // ── close ──────────────────────────────────

  it('close 清空 dock', () => {
    useWorkspaceStore.getState().openNote('a.md')
    useWorkspaceStore.getState().close()
    expect(useWorkspaceStore.getState().dock).toBeNull()
  })
})
