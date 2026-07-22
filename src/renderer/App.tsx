/**
 * App 根组件 — P-08 接入 PdfViewer
 */

import React from 'react'
import SplitLayout from './components/layout/SplitLayout'
import FileTree from './components/file-tree/FileTree'
import VaultSelector from './components/Sidebar/VaultSelector'
import NoteEditor from './components/editor/NoteEditor'
import PdfViewer from './components/pdf/PdfViewer'
import SearchPanel from './components/search/SearchPanel'
import CommandPalette from './components/search/CommandPalette'
import SettingsPage from './components/settings/SettingsPage'
import UpdateNotification from './components/common/UpdateNotification'

const App: React.FC = () => {
  const [showSettings, setShowSettings] = React.useState(false)
  const [sidebarOpen, setSidebarOpen] = React.useState(true)

  React.useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        setShowSettings(true)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <div style={styles.root}>
      {/* 左侧栏 */}
      <aside style={{
        ...styles.sidebar,
        width: sidebarOpen ? 260 : 0,
        minWidth: sidebarOpen ? 200 : 0,
        overflow: sidebarOpen ? undefined : 'hidden',
        borderRight: sidebarOpen ? '1px solid var(--border-primary)' : 'none'
      }}>
        <div style={styles.sidebarHeader}>
          <span style={{ flex: 1 }}>KnowledgeBase</span>
          <button
            onClick={() => setSidebarOpen(false)}
            style={styles.sidebarToggle}
            title="折叠侧栏"
          >
            ◀
          </button>
        </div>
        {sidebarOpen && (
          <>
            <VaultSelector />
            <div style={styles.treeContainer}>
              <FileTree />
            </div>
          </>
        )}
      </aside>

      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          style={styles.sidebarFloatBtn}
          title="展开侧栏"
        >
          ▶
        </button>
      )}

      {/* 主体 */}
      <main style={styles.main}>
        <SplitLayout
          noteSlot={<NoteEditor />}
          pdfSlot={<PdfViewer key="pdf-viewer" />}
          emptySlot={
            <div style={styles.emptyState}>
              <p style={{ fontSize: '18px', marginBottom: '16px', fontWeight: 500 }}>欢迎使用 KnowledgeBase</p>
              <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', lineHeight: 2, textAlign: 'center' }}>
                <p>① 点击侧栏 <b>📚 打开库...</b> → 选择本地文件夹</p>
                <p>② 在文件树中点击 <b>.md</b> 笔记开始编辑</p>
                <p>③ 打开 <b>PDF</b> → 点"+ 笔记"边读边记</p>
              </div>
            </div>
          }
        />
      </main>

      <SearchPanel />
      <CommandPalette onOpenSettings={() => setShowSettings(true)} />
      {showSettings && <SettingsPage onClose={() => setShowSettings(false)} />}
      <UpdateNotification />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden'
  },
  sidebar: {
    width: 260,
    minWidth: 200,
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid var(--border-primary)',
    backgroundColor: 'var(--bg-secondary)',
    overflow: 'hidden'
  },
  sidebarHeader: {
    padding: '14px 16px',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    borderBottom: '1px solid var(--border-secondary)',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    display: 'flex',
    alignItems: 'center'
  },
  sidebarToggle: {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 14,
    color: 'var(--text-tertiary)',
    padding: '0 4px'
  },
  sidebarFloatBtn: {
    position: 'fixed',
    left: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 48,
    padding: 0,
    border: '1px solid var(--border-primary)',
    borderLeft: 'none',
    borderRadius: '0 var(--radius-md) var(--radius-md) 0',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-tertiary)',
    fontSize: 12,
    cursor: 'pointer',
    boxShadow: 'var(--shadow-md)'
  },
  treeContainer: {
    flex: 1,
    overflow: 'hidden'
  },
  main: {
    flex: 1,
    overflow: 'hidden'
  },
  contentPlaceholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    fontSize: '14px',
    color: 'var(--text-tertiary)',
    backgroundColor: 'var(--bg-primary)'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-secondary)'
  }
}

export default App
