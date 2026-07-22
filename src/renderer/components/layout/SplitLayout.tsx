/**
 * 分屏布局容器
 *
 * 根据 DockState.mode 决定渲染：
 * - 'note' → 单栏笔记
 * - 'pdf'  → 单栏 PDF
 * - 'split'→ 左/右双栏（react-resizable-panels）
 *
 * 子组件通过插槽注入，P-06~P-08 实现具体面板。
 */

import React from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { useWorkspaceStore } from '../../stores/workspace.store'

interface SplitLayoutProps {
  /** 笔记编辑器插槽 */
  noteSlot: React.ReactNode
  /** PDF 阅读器插槽 */
  pdfSlot: React.ReactNode
  /** 空状态插槽 */
  emptySlot: React.ReactNode
}

const SplitLayout: React.FC<SplitLayoutProps> = ({ noteSlot, pdfSlot, emptySlot }) => {
  const dock = useWorkspaceStore((s) => s.dock)
  const setSplitRatio = useWorkspaceStore((s) => s.setSplitRatio)

  // ── 无 dock ─────────────────────────────────
  if (!dock) {
    return <div style={styles.empty}>{emptySlot}</div>
  }

  // ── 单栏 ─────────────────────────────────────
  if (dock.mode === 'note') {
    return <div style={styles.panel}>{noteSlot}</div>
  }

  if (dock.mode === 'pdf') {
    return <div style={styles.panel}>{pdfSlot}</div>
  }

  // ── 分屏 ─────────────────────────────────────
  const { splitRatio, pdfSide } = dock
  const leftRatio = pdfSide === 'left' ? splitRatio * 100 : (1 - splitRatio) * 100

  return (
    <PanelGroup
      direction="horizontal"
      onLayout={(sizes: number[]) => {
        const ratio = pdfSide === 'left' ? sizes[0] / 100 : sizes[1] / 100
        setSplitRatio(ratio)
      }}
    >
      <Panel defaultSize={leftRatio} minSize={30} maxSize={70}>
        {pdfSide === 'left' ? pdfSlot : noteSlot}
      </Panel>

      <PanelResizeHandle style={styles.handle}>
        <div style={styles.handleDot} />
      </PanelResizeHandle>

      <Panel defaultSize={100 - leftRatio} minSize={30} maxSize={70}>
        {pdfSide === 'left' ? noteSlot : pdfSlot}
      </Panel>
    </PanelGroup>
  )
}

// ── 样式 ──────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-secondary)',
    fontSize: '14px'
  },
  panel: {
    height: '100%',
    overflow: 'hidden'
  },
  handle: {
    width: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--bg-tertiary)',
    cursor: 'col-resize',
    transition: 'background-color 0.15s'
  },
  handleDot: {
    width: 2,
    height: 24,
    borderRadius: 1,
    backgroundColor: 'var(--split-handle-bg)'
  }
}

export default SplitLayout
