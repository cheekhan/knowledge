import React, { useState } from 'react'

interface Props { tags: string[]; onChange: (tags: string[]) => void }

const TagInput: React.FC<Props> = ({ tags, onChange }) => {
  const [v, setV] = useState('')
  const add = () => { const t = v.trim(); if (t && !tags.includes(t)) onChange([...tags, t]); setV('') }
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        {tags.map((t) => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '2px 6px', borderRadius: 4, backgroundColor: 'var(--bg-active)', fontSize: 11, color: 'var(--text-secondary)' }}>
            {t}
            <button onClick={() => onChange(tags.filter((x) => x !== t))} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-tertiary)', padding: 0, lineHeight: 1 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} placeholder="添加标签..." style={{ flex: 1, padding: '3px 6px', border: '1px solid var(--border-primary)', borderRadius: 4, fontSize: 11, backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
        <button onClick={add} style={{ padding: '3px 8px', border: '1px solid var(--border-primary)', borderRadius: 4, fontSize: 11, cursor: 'pointer', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>+</button>
      </div>
    </div>
  )
}

export default TagInput
