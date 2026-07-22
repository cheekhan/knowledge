/**
 * 全局搜索面板 — FTS5 全文搜索
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { searchService } from '../../services/search.service'
import { useWorkspaceStore } from '../../stores/workspace.store'
import type { SearchHit } from '../../../shared/types'

const SearchPanel: React.FC = () => {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchHit[]>([])
  const [visible, setVisible] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const openNote = useWorkspaceStore((s) => s.openNote)
  const openPdf = useWorkspaceStore((s) => s.openPdf)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  // ── Cmd/Ctrl+F 打开搜索 ──────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setVisible(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') setVisible(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── 防抖搜索 ────────────────────────────────

  const doSearch = useCallback(async (text: string) => {
    if (!text.trim()) { setResults([]); return }
    try {
      const hits = await searchService.query(text)
      setResults(hits)
    } catch { setResults([]) }
  }, [])

  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSearch(q), 300)
    return () => clearTimeout(timerRef.current)
  }, [q, doSearch])

  // ── 结果点击 ────────────────────────────────

  const handleClick = (hit: SearchHit) => {
    if (hit.kind === 'note') openNote(hit.path)
    else openPdf(hit.path)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={S.bd} onClick={() => setVisible(false)}>
      <div style={S.panel} onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索笔记、PDF…"
          style={S.input}
        />
        <div style={S.list}>
          {results.length === 0 && q.trim() && (
            <div style={S.empty}>无结果</div>
          )}
          {results.map((hit, i) => (
            <div
              key={hit.path + i}
              onClick={() => handleClick(hit)}
              style={S.item}
            >
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginRight: 8 }}>
                {hit.kind === 'note' ? '📝' : '📄'}
              </span>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{hit.title}</div>
                {hit.snippet && (
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}
                    dangerouslySetInnerHTML={{ __html: hit.snippet }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const S = {
  bd: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)', zIndex: 999, display: 'flex', justifyContent: 'center', paddingTop: '15vh' },
  panel: { width: 520, maxHeight: '60vh', backgroundColor: 'var(--bg-primary)', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  input: { padding: '14px 16px', border: 'none', borderBottom: '1px solid var(--border-secondary)', fontSize: 15, outline: 'none', backgroundColor: 'transparent', color: 'var(--text-primary)' },
  list: { overflow: 'auto', flex: 1, padding: 4 },
  item: { display: 'flex', alignItems: 'flex-start', padding: '8px 12px', cursor: 'pointer', borderRadius: 4 },
  empty: { padding: '24px', textAlign: 'center' as const, fontSize: 13, color: 'var(--text-tertiary)' }
}

export default SearchPanel
