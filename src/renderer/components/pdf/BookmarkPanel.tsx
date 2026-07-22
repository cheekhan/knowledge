/**
 * BookmarkPanel — PDF 书签侧栏（O-02.3）
 *
 * 替代原 TagInput，展示：
 * - PDF 内置目录（Outline）
 * - 用户手动添加的页级书签
 *
 * 支持添加/删除/跳转书签。
 */

import React, { useEffect, useState, useCallback } from 'react'
import OutlineTree from './OutlineTree'
import type { PdfEngine, OutlineItem } from './engine/PdfEngine'
import type { PdfBookmark } from '../../../shared/types'
import { pdfService } from '../../services/pdf.service'

interface Props {
  pdfPath: string
  engine: PdfEngine | null
  bookmarks: PdfBookmark[]
  currentPage: number
  onJump: (page: number) => void
  onBookmarksChange: (bookmarks: PdfBookmark[]) => void
}

const BookmarkPanel: React.FC<Props> = ({
  pdfPath,
  engine,
  bookmarks,
  currentPage,
  onJump,
  onBookmarksChange
}) => {
  const [outline, setOutline] = useState<OutlineItem[]>([])
  const [outlineOpen, setOutlineOpen] = useState(true)
  const [userBookmarksOpen, setUserBookmarksOpen] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  // 加载 PDF 内置目录
  useEffect(() => {
    if (!engine) return
    engine.getOutline().then(setOutline).catch(() => setOutline([]))
  }, [engine])

  // 添加书签
  const handleAdd = useCallback(async () => {
    const title = newTitle.trim() || `第 ${currentPage} 页`
    const bookmark: PdfBookmark = {
      id: crypto.randomUUID(),
      title,
      page: currentPage,
      createdAt: new Date().toISOString()
    }
    const updated = [...bookmarks, bookmark]
    onBookmarksChange(updated)
    await pdfService.updateMeta(pdfPath, { bookmarks: updated } as Parameters<typeof pdfService.updateMeta>[1])
    setNewTitle('')
    setAdding(false)
  }, [newTitle, currentPage, bookmarks, onBookmarksChange, pdfPath])

  // 删除书签
  const handleDelete = useCallback(async (id: string) => {
    const updated = bookmarks.filter((b) => b.id !== id)
    onBookmarksChange(updated)
    await pdfService.updateMeta(pdfPath, { bookmarks: updated } as Parameters<typeof pdfService.updateMeta>[1])
  }, [bookmarks, onBookmarksChange, pdfPath])

  return (
    <div style={{ padding: '4px 0', maxHeight: '50vh', overflowY: 'auto' }}>
      {/* 添加书签按钮 */}
      {adding ? (
        <div style={{ padding: '0 8px', marginBottom: 8 }}>
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd()
              if (e.key === 'Escape') { setAdding(false); setNewTitle('') }
            }}
            placeholder={`第 ${currentPage} 页`}
            style={{
              width: '100%',
              padding: '4px 6px',
              fontSize: 12,
              border: '1px solid var(--border-primary)',
              borderRadius: 3,
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              outline: 'none'
            }}
          />
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button onClick={handleAdd} style={miniBtnStyle}>添加</button>
            <button onClick={() => { setAdding(false); setNewTitle('') }} style={miniBtnStyle}>取消</button>
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: '4px 8px',
            marginBottom: 4,
            cursor: 'pointer',
            fontSize: 12,
            color: 'var(--text-accent)',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
          onClick={() => setAdding(true)}
        >
          <span>+</span>
          <span>添加当前页书签</span>
        </div>
      )}

      {/* PDF 内置目录 */}
      {outline.length > 0 && (
        <div>
          <div
            style={sectionHeaderStyle}
            onClick={() => setOutlineOpen(!outlineOpen)}
          >
            <span>目录</span>
            <span>{outlineOpen ? '▾' : '▸'}</span>
          </div>
          {outlineOpen && (
            <OutlineTree items={outline} onJump={onJump} />
          )}
        </div>
      )}

      {/* 用户书签 */}
      <div>
        <div
          style={{ ...sectionHeaderStyle, marginTop: outline.length > 0 ? 4 : 0 }}
          onClick={() => setUserBookmarksOpen(!userBookmarksOpen)}
        >
          <span>我的书签</span>
          <span>{userBookmarksOpen ? '▾' : '▸'}</span>
        </div>
        {userBookmarksOpen && (
          <div>
            {bookmarks.length === 0 && (
              <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-tertiary)' }}>
                暂无书签，点击上方按钮添加
              </div>
            )}
            {bookmarks.map((bm) => (
              <div
                key={bm.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '3px 8px',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  borderRadius: 3
                }}
                onClick={() => onJump(bm.page)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <span style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {bm.title}
                </span>
                <span style={{
                  fontSize: 10,
                  color: 'var(--text-tertiary)',
                  marginLeft: 6,
                  flexShrink: 0
                }}>
                  p.{bm.page}
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(bm.id)
                  }}
                  style={{
                    marginLeft: 6,
                    fontSize: 12,
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                  title="删除书签"
                >
                  ×
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const sectionHeaderStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-tertiary)',
  borderBottom: '1px solid var(--border-secondary)',
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'space-between',
  userSelect: 'none'
}

const miniBtnStyle: React.CSSProperties = {
  padding: '2px 8px',
  fontSize: 11,
  border: '1px solid var(--border-primary)',
  borderRadius: 3,
  backgroundColor: 'var(--bg-secondary)',
  color: 'var(--text-secondary)',
  cursor: 'pointer'
}

export default BookmarkPanel
