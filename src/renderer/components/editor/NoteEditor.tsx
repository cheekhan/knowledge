/**
 * 笔记编辑器 — CodeMirrorView + MarkdownPreview + 自动保存
 */

import React, { useState, useEffect } from 'react'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { useEditorStore } from '../../stores/editor.store'
import { noteService } from '../../services/note.service'
import CodeMirrorView from './CodeMirrorView'
import MarkdownPreview from './MarkdownPreview'
import EditorToolbar, { type EditorMode } from './EditorToolbar'
import { useAutoSave } from './useAutoSave'

const NoteEditor: React.FC = () => {
  const dock = useWorkspaceStore((s) => s.dock)
  const notePath = dock && ('notePath' in dock) ? dock.notePath : null

  const currentPath = useEditorStore((s) => s.currentPath)
  const content = useEditorStore((s) => s.content)
  const open = useEditorStore((s) => s.open)
  const setContent = useEditorStore((s) => s.setContent)
  const reload = useEditorStore((s) => s.reload)

  const [mode, setMode] = useState<EditorMode>('source')
  const { saveNow } = useAutoSave()

  // ── 文件切换 → 加载内容 ──────────────────────

  useEffect(() => {
    if (!notePath || notePath === currentPath) return

    noteService
      .read(notePath)
      .then((text) => {
        open(notePath, text)
      })
      .catch(() => {
        // 文件不存在
      })
  }, [notePath])

  // ── 外部修改检测 ────────────────────────────

  useEffect(() => {
    const unsub = noteService.onExternallyModified((relPath: string) => {
      if (relPath !== useEditorStore.getState().currentPath) return
      const dirty = useEditorStore.getState().isDirty

      if (!dirty) {
        // 无未保存更改 → 静默重载
        noteService.read(relPath).then((text) => reload(text))
      }
      // 有未保存更改 → P-12 完善冲突对话框
    })
    return unsub
  }, [])

  // ── Ctrl+S 手动保存 ──────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        saveNow()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [saveNow])

  // ── 无笔记时 ─────────────────────────────────

  if (!notePath) {
    return (
      <div style={styles.empty}>打开一篇笔记开始编辑</div>
    )
  }

  return (
    <div style={styles.container}>
      <EditorToolbar mode={mode} onModeChange={setMode} />

      <div style={styles.body}>
        {mode === 'source' ? (
          <CodeMirrorView
            key={notePath}
            value={content}
            onChange={setContent}
          />
        ) : (
          <MarkdownPreview content={content} />
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%'
  },
  body: {
    flex: 1,
    overflow: 'hidden'
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    fontSize: '14px',
    color: 'var(--text-tertiary)'
  }
}

export default NoteEditor
