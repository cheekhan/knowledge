/**
 * 自动保存 Hook — 防抖 + 三态指示
 */

import { useEffect, useRef } from 'react'
import { useEditorStore } from '../../stores/editor.store'
import { noteService } from '../../services/note.service'
import { AUTO_SAVE_DEBOUNCE_MS } from '../../../shared/constants'

export function useAutoSave(): { saveNow: () => Promise<void> } {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentPath = useEditorStore((s) => s.currentPath)
  const content = useEditorStore((s) => s.content)
  const isDirty = useEditorStore((s) => s.isDirty)
  const setSaving = useEditorStore((s) => s.setSaving)
  const setSaved = useEditorStore((s) => s.setSaved)

  const save = async () => {
    if (!currentPath) return
    setSaving()
    try {
      await noteService.write(currentPath, content)
      setSaved()
    } catch {
      // 保存失败保持 unsaved 状态
    }
  }

  // ── 防抖自动保存 ────────────────────────────

  useEffect(() => {
    if (!isDirty || !currentPath) return

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      timerRef.current = null
      save()
    }, AUTO_SAVE_DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [content, isDirty, currentPath])

  // ── beforeunload 拦截 ────────────────────────

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (useEditorStore.getState().isDirty) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  return { saveNow: save }
}
