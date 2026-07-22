import React, { useState, useRef, useEffect } from 'react'
import type { PdfEngine } from './engine/PdfEngine'

interface Props { engine: PdfEngine; pageCount: number; onClose: () => void }

const PdfFindBar: React.FC<Props> = ({ engine }) => {
  const [q, setQ] = useState('')
  const [count, setCount] = useState(0)
  const [nf, setNf] = useState(false)
  const inp = useRef<HTMLInputElement>(null)
  useEffect(() => { inp.current?.focus() }, [])

  const find = async () => {
    if (!q.trim()) { setCount(0); return }
    let c = 0
    for (let p = 1; p <= engine.getPageCount(); p++) {
      const page = await engine.getPage(p)
      const items = page.getTextItems()
      if (items) {
        const t = items.map((x) => x.text).join(' ')
        if (t.includes(q)) c++
      }
    }
    setCount(c); setNf(c === 0)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderBottom: '1px solid var(--border-secondary)', backgroundColor: 'var(--bg-secondary)', fontSize: 12 }}>
      <input ref={inp} value={q} onChange={(e) => { setQ(e.target.value); setNf(false) }} onKeyDown={(e) => { if (e.key === 'Enter') find() }} placeholder="查找..." style={{ padding: '2px 8px', border: '1px solid var(--border-primary)', borderRadius: 4, width: 160, fontSize: 12, backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
      <button onClick={find} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12 }}>🔍</button>
      {count > 0 && <span style={{ color: 'var(--text-tertiary)' }}>{count} 页匹配</span>}
      {nf && <span style={{ color: 'var(--color-danger)' }}>未找到</span>}
    </div>
  )
}

export default PdfFindBar
