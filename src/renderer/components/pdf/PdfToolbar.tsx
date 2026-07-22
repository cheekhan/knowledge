import React, { useState, useEffect } from 'react'

interface Props {
  page: number; pageCount: number; scale: number
  onPageChange: (n: number) => void; onScaleChange: (s: number) => void
  onCreateNote?: () => void
  sidePanelOpen?: boolean; onToggleSidePanel?: () => void
  onToggleFind?: () => void
  /** 当前是否分屏中（控制折叠笔记按钮显示） */
  isSplit?: boolean
  onCollapseNote?: () => void
}

const B = { scale: 1.25 }
const PdfToolbar: React.FC<Props> = ({ page, pageCount, scale, onPageChange, onScaleChange, onCreateNote, sidePanelOpen, onToggleSidePanel, onToggleFind, isSplit, onCollapseNote }) => {
  // 本地输入状态：允许自由编辑（清空、输入），仅在 Enter/blur 时提交
  const [inputValue, setInputValue] = useState(String(page))

  // 外部 page 变化时（滚动/翻页按钮）同步本地输入
  useEffect(() => {
    setInputValue(String(page))
  }, [page])

  const commitPage = (raw: string) => {
    const n = parseInt(raw, 10)
    if (!isNaN(n) && n >= 1 && n <= pageCount) {
      onPageChange(n)
    } else {
      // 无效输入回退到当前页
      setInputValue(String(page))
    }
  }

  return (
    <div style={S.bar}>
      <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} style={S.btn}>‹</button>
      <input
        type="number"
        value={inputValue}
        min={1}
        max={pageCount}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur()
          }
        }}
        onBlur={(e) => commitPage(e.target.value)}
        style={S.input}
      />
      <span style={S.muted}>/ {pageCount}</span>
      <button disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} style={S.btn}>›</button>
      <div style={S.sep} />
      <button onClick={() => onScaleChange(Math.max(0.5, scale / B.scale))} style={S.btn}>−</button>
      <span style={{ ...S.muted, width: 44, textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
      <button onClick={() => onScaleChange(Math.min(4, scale * B.scale))} style={S.btn}>+</button>
      <div style={{ flex: 1 }} />
      {onToggleFind && (
        <button onClick={onToggleFind} style={S.btn} title="查找">🔍</button>
      )}
      {onToggleSidePanel && (
        <button onClick={onToggleSidePanel} style={S.btn} title={sidePanelOpen ? '折叠面板' : '展开面板'}>
          {sidePanelOpen ? '◀' : '▶'}
        </button>
      )}
      {isSplit && onCollapseNote && (
        <button onClick={onCollapseNote} style={S.btn} title="折叠笔记">✕</button>
      )}
      <button onClick={onCreateNote} style={{ ...S.btn, color: 'var(--color-accent)' }}>+ 笔记</button>
    </div>
  )
}

const S = {
  bar: { display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 12px', borderBottom: '1px solid var(--border-secondary)', backgroundColor: 'var(--bg-secondary)', flexShrink: 0, fontSize: 12 } as React.CSSProperties,
  btn: { border: 'none', borderRadius: 4, padding: '2px 8px', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' } as React.CSSProperties,
  input: { width: 50, textAlign: 'center' as const, border: '1px solid var(--border-primary)', borderRadius: 4, padding: '2px 4px', fontSize: 12, backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' } as React.CSSProperties,
  muted: { color: 'var(--text-tertiary)' } as React.CSSProperties,
  sep: { width: 1, height: 20, backgroundColor: 'var(--border-secondary)', margin: '0 4px' } as React.CSSProperties
}

export default PdfToolbar
