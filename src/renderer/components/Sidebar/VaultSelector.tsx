/**
 * 库选择器 — 打开/切换 Vault + 最近库列表
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useVaultStore } from '../../stores/vault.store'
import type { RecentVaultEntry } from '../../../shared/types'

const VaultSelector: React.FC = () => {
  const vaultPath = useVaultStore((s) => s.vaultPath)
  const setVault = useVaultStore((s) => s.setVault)
  const [recentVaults, setRecentVaults] = useState<RecentVaultEntry[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  // ── 加载最近库 ───────────────────────────────

  useEffect(() => {
    window.api.vault.getRecent().then(setRecentVaults).catch(() => setRecentVaults([]))
  }, [vaultPath])

  // ── 打开库 ───────────────────────────────────

  const handleBrowseFolder = useCallback(async () => {
    const folder = await window.api.vault.browseFolder()
    if (folder) {
      try {
        const summary = await window.api.vault.open(folder)
        setVault(summary)
      } catch {
        // ignore
      }
    }
    setShowDropdown(false)
  }, [setVault])

  const handleSelectVault = useCallback(
    async (path: string) => {
      try {
        const summary = await window.api.vault.open(path)
        setVault(summary)
        setShowDropdown(false)
      } catch {
        // P-12 完善错误提示
      }
    },
    [setVault]
  )

  // ── 渲染 ─────────────────────────────────────

  const vaultName = vaultPath
    ? vaultPath.split(/[/\\]/).filter(Boolean).pop() || vaultPath
    : null

  return (
    <div style={styles.container}>
      <div
        style={styles.trigger}
        onClick={() => setShowDropdown(!showDropdown)}
        title={vaultPath ?? '选择库'}
      >
        <span style={styles.icon}>📚</span>
        <span style={styles.name}>
          {vaultName ?? '打开库...'}
        </span>
        <span style={styles.chevron}>{showDropdown ? '▴' : '▾'}</span>
      </div>

      {showDropdown && (
        <div style={styles.dropdown}>
          <div style={{ ...styles.dropdownItem, fontWeight: 500 }} onClick={handleBrowseFolder}>
            📂 打开文件夹...
          </div>
          <div style={styles.dropdownHeader}>最近打开的库</div>
          {recentVaults.length === 0 && (
            <div style={styles.emptyItem}>暂无</div>
          )}
          {recentVaults.map((entry) => (
            <div
              key={entry.path}
              style={{
                ...styles.dropdownItem,
                ...(entry.path === vaultPath
                  ? { backgroundColor: 'var(--bg-active)' }
                  : {})
              }}
              onClick={() => handleSelectVault(entry.path)}
            >
              {entry.path}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 样式 ──────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    borderBottom: '1px solid var(--border-secondary)'
  },
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    cursor: 'pointer',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-primary)'
  },
  icon: {
    fontSize: '14px'
  },
  name: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  chevron: {
    fontSize: '10px',
    color: 'var(--text-tertiary)',
    flexShrink: 0
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 4,
    right: 4,
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-md)',
    zIndex: 100,
    maxHeight: 240,
    overflowY: 'auto'
  },
  dropdownHeader: {
    padding: '8px 12px',
    fontSize: '11px',
    color: 'var(--text-tertiary)',
    borderBottom: '1px solid var(--border-secondary)'
  },
  dropdownItem: {
    padding: '8px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  emptyItem: {
    padding: '12px',
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    textAlign: 'center'
  }
}

export default VaultSelector
