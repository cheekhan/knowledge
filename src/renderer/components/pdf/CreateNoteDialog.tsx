import React, { useState } from 'react'

interface Props {
  defaultName: string
  onConfirm: (name: string) => void
  onCancel: () => void
}

const CreateNoteDialog: React.FC<Props> = ({ defaultName, onConfirm, onCancel }) => {
  const [name, setName] = useState(defaultName)
  return (
    <div style={S.bd} onClick={onCancel}>
      <div style={S.d} onClick={(e) => e.stopPropagation()}>
        <div style={S.t}>新建绑定笔记</div>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onConfirm(name); if (e.key === 'Escape') onCancel() }} style={S.i} />
        <div style={S.btns}>
          <button onClick={onCancel} style={{ ...S.btn, backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>取消</button>
          <button onClick={() => onConfirm(name)} style={{ ...S.btn, backgroundColor: 'var(--color-accent)', color: '#fff' }}>创建</button>
        </div>
      </div>
    </div>
  )
}

const S = {
  bd: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  d: { backgroundColor: 'var(--bg-primary)', borderRadius: 8, padding: 20, width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
  t: { fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' },
  i: { width: '100%', padding: '8px 12px', border: '1px solid var(--border-primary)', borderRadius: 6, fontSize: 14, backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' },
  btns: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  btn: { padding: '6px 16px', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }
}

export default CreateNoteDialog
