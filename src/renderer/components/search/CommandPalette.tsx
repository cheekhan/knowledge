import React, { useState, useEffect, useRef } from 'react'
import { useWorkspaceStore } from '../../stores/workspace.store'

const CommandPalette: React.FC<{ onOpenSettings?: () => void }> = ({ onOpenSettings }) => {
  const [v, setV] = useState(false)
  const [q, setQ] = useState('')
  const inp = useRef<HTMLInputElement>(null)
  const close = useWorkspaceStore((s) => s.close)

  const cmds = [
    { id: 'close', label: '关闭工作区', action: () => close() },
    ...(onOpenSettings ? [{ id: 'settings', label: '设置...', action: () => onOpenSettings() }] : [])
  ]
  const filtered = cmds.filter((c) => c.label.includes(q))

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setV(true); setQ(''); setTimeout(() => inp.current?.focus(), 50) }
      if (e.key === 'Escape') setV(false)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  if (!v) return null
  return (
    <div onClick={() => setV(false)} style={S.bd}>
      <div onClick={(e) => e.stopPropagation()} style={S.p}>
        <input ref={inp} value={q} onChange={(e) => setQ(e.target.value)} placeholder="输入命令…" style={S.i} />
        {filtered.map((c) => (
          <div key={c.id} style={S.r} onClick={() => { c.action(); setV(false) }}>{c.label}</div>
        ))}
      </div>
    </div>
  )
}

const S = {
  bd: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)', zIndex: 999, display: 'flex', justifyContent: 'center', paddingTop: '12vh' },
  p: { width: 420, backgroundColor: 'var(--bg-primary)', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.2)', overflow: 'hidden' },
  i: { width: '100%', padding: '14px 16px', border: 'none', borderBottom: '1px solid var(--border-secondary)', fontSize: 15, outline: 'none', backgroundColor: 'transparent', color: 'var(--text-primary)', boxSizing: 'border-box' as const },
  r: { padding: '10px 16px', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }
}

export default CommandPalette
