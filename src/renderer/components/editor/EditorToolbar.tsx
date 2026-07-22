import React from 'react'
import { useEditorStore, type SaveState } from '../../stores/editor.store'

export type EditorMode = 'source' | 'preview'

interface Props { mode: EditorMode; onModeChange: (m: EditorMode) => void }

const LABEL: Record<SaveState, string> = { saved: '已保存', saving: '保存中...', unsaved: '未保存' }
const CLR: Record<SaveState, string> = { saved: 'var(--color-success)', saving: 'var(--color-warning)', unsaved: 'var(--color-danger)' }

const EditorToolbar: React.FC<Props> = ({ mode, onModeChange }) => {
  const saveState = useEditorStore((s) => s.saveState)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 36, padding: '0 12px', borderBottom: '1px solid var(--border-secondary)', backgroundColor: 'var(--bg-secondary)', flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {(['source', 'preview'] as EditorMode[]).map((m) => (
          <button key={m} onClick={() => onModeChange(m)} style={{ padding: '3px 10px', border: 'none', borderRadius: 4, backgroundColor: mode === m ? 'var(--bg-active)' : 'transparent', color: mode === m ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontWeight: mode === m ? 500 : 400 }}>{m === 'source' ? '源码' : '预览'}</button>
        ))}
      </div>
      <span style={{ fontSize: 11, color: CLR[saveState] }}>{LABEL[saveState]}</span>
    </div>
  )
}

export default EditorToolbar
