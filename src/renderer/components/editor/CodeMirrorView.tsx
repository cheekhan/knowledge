import React, { useEffect, useRef } from 'react'
import { EditorView, keymap, lineNumbers, highlightSpecialChars } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'

interface Props { value: string; onChange: (v: string) => void }

const CodeMirrorView: React.FC<Props> = ({ value, onChange }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(), highlightSpecialChars(), history(), markdown(),
          syntaxHighlighting(defaultHighlightStyle),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.updateListener.of((u) => { if (u.docChanged) onChange(u.state.doc.toString()) }),
          EditorView.theme({
            '&': { height: '100%', fontSize: '14px' },
            '.cm-scroller': { overflow: 'auto' },
            '.cm-content': { fontFamily: 'monospace', padding: '16px' },
            '.cm-cursor': { borderLeftColor: '#e0e0e0' },
            '.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--bg-active)' }
          }, { dark: true })
        ]
      }),
      parent: containerRef.current
    })
    viewRef.current = view
    return () => { view.destroy(); viewRef.current = null }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const cur = view.state.doc.toString()
    if (value !== cur) view.dispatch({ changes: { from: 0, to: cur.length, insert: value } })
  }, [value])

  return <div ref={containerRef} style={{ height: '100%' }} />
}

export default CodeMirrorView
