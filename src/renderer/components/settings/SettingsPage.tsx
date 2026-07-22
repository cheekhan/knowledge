/**
 * 设置页 — 主题 / 字号 / 重建索引
 */

import React, { useEffect, useState } from 'react'
import type { AppSettings } from '../../../shared/types'

const SettingsPage: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [s, setS] = useState<AppSettings>({ theme: 'system', editorFontSize: 14, autoSaveIntervalMs: 1000 })
  const [rebuilding, setRebuilding] = useState(false)
  const [checking, setChecking] = useState(false)
  const [updateMsg, setUpdateMsg] = useState<string | null>(null)

  useEffect(() => {
    window.api.settings.get().then(setS).catch(() => {})
  }, [])

  const handleCheckUpdate = async () => {
    setChecking(true)
    setUpdateMsg(null)
    try {
      const result = await window.api.update.checkForUpdates()
      setUpdateMsg(result ? `发现新版本 v${result.version}` : '已是最新版本')
    } catch (e: unknown) {
      setUpdateMsg(`检查失败: ${(e as Error).message ?? '未知错误'}`)
    } finally {
      setChecking(false)
    }
  }

  const update = (p: Partial<AppSettings>) => {
    const next = { ...s, ...p }
    setS(next)
    window.api.settings.update(p)
    if (p.theme) applyTheme(p.theme)
  }

  const applyTheme = (t: string) => {
    if (t === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', t)
  }

  return (
    <div style={S.bd} onClick={onClose}>
      <div style={S.p} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>设置</h3>

        <div style={S.row}>
          <span>主题</span>
          <select value={s.theme} onChange={(e) => update({ theme: e.target.value as AppSettings['theme'] })} style={S.sel}>
            <option value="system">跟随系统</option>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </div>

        <div style={S.row}>
          <span>编辑器字号</span>
          <input type="number" min={10} max={24} value={s.editorFontSize} onChange={(e) => update({ editorFontSize: +e.target.value })} style={S.inp} />
        </div>

        <div style={{ ...S.row, marginTop: 20 }}>
          <span>版本</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>v1.0.0</span>
        </div>

        <div style={{ marginTop: 20 }}>
          <button disabled={rebuilding} onClick={async () => { setRebuilding(true); await window.api.search.rebuildIndex(); setRebuilding(false) }} style={S.btn2}>
            {rebuilding ? '重建中...' : '重建搜索索引'}
          </button>
        </div>

        <div style={{ marginTop: 10 }}>
          <button disabled={checking} onClick={handleCheckUpdate} style={S.btn2}>
            {checking ? '检查中...' : '检查更新'}
          </button>
          {updateMsg && (
            <span style={{ marginLeft: 12, fontSize: 12, color: updateMsg.includes('失败') ? 'var(--color-danger)' : 'var(--text-tertiary)' }}>
              {updateMsg}
            </span>
          )}
        </div>

        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <button onClick={onClose} style={S.btn}>关闭</button>
        </div>
      </div>
    </div>
  )
}

const S = {
  bd: { position: 'fixed' as const, inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  p: { backgroundColor: 'var(--bg-primary)', borderRadius: 8, padding: 24, width: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', color: 'var(--text-primary)' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: 13 },
  sel: { padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' },
  inp: { width: 60, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', textAlign: 'center' as const },
  btn: { padding: '6px 16px', border: '1px solid var(--border-primary)', borderRadius: 6, cursor: 'pointer', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 },
  btn2: { padding: '6px 16px', border: '1px solid var(--border-primary)', borderRadius: 6, cursor: 'pointer', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 }
}

export default SettingsPage
