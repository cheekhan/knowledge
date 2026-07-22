/**
 * 自动更新通知组件 — P-14
 *
 * 监听主进程推送的更新状态，展示通知横幅与操作按钮。
 * 仅在检测到新版本可用时展示核心 UI，"已是最新" 与 "检查中" 自动收起。
 */

import React, { useEffect, useState } from 'react'
import type { UpdateStatus } from '../../../shared/types'

const UpdateNotification: React.FC = () => {
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const unsub = window.api.update.onUpdateStatus((s) => {
      setStatus(s)
      // 仅在"有更新可用 / 下载中 / 已下载 / 出错"三种状态展示通知
      if (s.phase === 'available' || s.phase === 'downloading' || s.phase === 'downloaded' || s.phase === 'error') {
        setVisible(true)
      } else if (s.phase === 'not-available' || s.phase === 'checking') {
        setVisible(false)
      }
    })
    return unsub
  }, [])

  if (!visible || !status) return null

  const handleDownload = () => {
    window.api.update.downloadAndInstall()
  }

  return (
    <div style={S.overlay}>
      <div style={S.card}>
        {/* 标题 */}
        <div style={S.title}>
          {status.phase === 'available' && '发现新版本'}
          {status.phase === 'downloading' && `正在下载更新... ${status.progress ?? 0}%`}
          {status.phase === 'downloaded' && '更新已就绪'}
          {status.phase === 'error' && '更新出错'}
        </div>

        {/* 版本号 */}
        {status.version && (
          <div style={S.version}>新版本 v{status.version}</div>
        )}

        {/* 进度条 */}
        {status.phase === 'downloading' && (
          <div style={S.progressBar}>
            <div style={{ ...S.progressFill, width: `${status.progress ?? 0}%` }} />
          </div>
        )}

        {/* 错误信息 */}
        {status.phase === 'error' && status.error && (
          <div style={S.error}>{status.error}</div>
        )}

        {/* 操作按钮 */}
        <div style={S.actions}>
          {status.phase === 'available' && (
            <button onClick={handleDownload} style={S.btnPrimary}>
              立即下载
            </button>
          )}
          {status.phase === 'downloaded' && (
            <button
              onClick={() => window.api.update.quitAndInstall()}
              style={S.btnPrimary}
            >
              重启安装
            </button>
          )}
          <button onClick={() => setVisible(false)} style={S.btnSecondary}>
            {status.phase === 'error' ? '关闭' : '稍后'}
          </button>
        </div>
      </div>
    </div>
  )
}

const S = {
  overlay: {
    position: 'fixed',
    bottom: 20,
    right: 20,
    zIndex: 1000,
    maxWidth: 340
  } as React.CSSProperties,
  card: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 12,
    padding: 16,
    boxShadow: 'var(--shadow-md)'
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 4
  } as React.CSSProperties,
  version: {
    fontSize: 12,
    color: 'var(--text-tertiary)',
    marginBottom: 8
  } as React.CSSProperties,
  progressBar: {
    height: 4,
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: 2,
    marginBottom: 12,
    overflow: 'hidden'
  } as React.CSSProperties,
  progressFill: {
    height: '100%',
    backgroundColor: 'var(--color-accent)',
    borderRadius: 2,
    transition: 'width 0.3s ease'
  } as React.CSSProperties,
  error: {
    fontSize: 11,
    color: 'var(--color-danger)',
    marginBottom: 8
  } as React.CSSProperties,
  actions: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end'
  } as React.CSSProperties,
  btnPrimary: {
    padding: '5px 14px',
    border: 'none',
    borderRadius: 6,
    backgroundColor: 'var(--color-accent)',
    color: '#fff',
    fontSize: 12,
    cursor: 'pointer'
  } as React.CSSProperties,
  btnSecondary: {
    padding: '5px 14px',
    border: '1px solid var(--border-primary)',
    borderRadius: 6,
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 12,
    cursor: 'pointer'
  } as React.CSSProperties
}

export default UpdateNotification
