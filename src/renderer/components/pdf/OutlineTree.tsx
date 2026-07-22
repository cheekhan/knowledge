/**
 * OutlineTree — PDF 内置目录树形组件（O-02.3）
 *
 * 可折叠树形展示 PDF 内置 Outline，点击跳转到对应页。
 */

import React, { useState } from 'react'
import type { OutlineItem } from './engine/PdfEngine'

interface Props {
  items: OutlineItem[]
  onJump: (page: number) => void
  /** 缩进级别，内部使用 */
  depth?: number
}

const OutlineTree: React.FC<Props> = ({ items, onJump, depth = 0 }) => {
  return (
    <div>
      {items.map((item, idx) => (
        <OutlineNode
          key={`${item.page}-${idx}-${depth}`}
          item={item}
          onJump={onJump}
          depth={depth}
        />
      ))}
    </div>
  )
}

const OutlineNode: React.FC<{
  item: OutlineItem
  onJump: (page: number) => void
  depth: number
}> = ({ item, onJump, depth }) => {
  const [expanded, setExpanded] = useState(depth < 1)
  const hasChildren = item.children && item.children.length > 0

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: `3px 8px 3px ${8 + depth * 16}px`,
          cursor: 'pointer',
          fontSize: 12,
          color: 'var(--text-secondary)',
          borderRadius: 3
        }}
        onClick={() => onJump(item.page)}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
        }}
        title={`${item.title} — 第 ${item.page} 页`}
      >
        {hasChildren && (
          <span
            style={{ marginRight: 4, fontSize: 10, flexShrink: 0 }}
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
          >
            {expanded ? '▾' : '▸'}
          </span>
        )}
        {!hasChildren && <span style={{ width: 14, flexShrink: 0 }} />}
        <span style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {item.title}
        </span>
        <span style={{
          fontSize: 10,
          color: 'var(--text-tertiary)',
          marginLeft: 6,
          flexShrink: 0
        }}>
          {item.page}
        </span>
      </div>
      {hasChildren && expanded && item.children && (
        <OutlineTree items={item.children} onJump={onJump} depth={depth + 1} />
      )}
    </div>
  )
}

export default OutlineTree
