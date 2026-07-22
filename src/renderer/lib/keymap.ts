/**
 * 快捷键定义 — 集中管理所有键盘快捷键
 */

export interface ShortcutDef {
  id: string
  keys: string
  description: string
}

export const shortcuts: ShortcutDef[] = [
  { id: 'search', keys: 'Cmd/Ctrl+F', description: '全局搜索' },
  { id: 'command', keys: 'Cmd/Ctrl+K', description: '命令面板' },
  { id: 'save', keys: 'Cmd/Ctrl+S', description: '保存笔记' },
  { id: 'close', keys: 'Escape', description: '关闭浮层/弹窗' }
]
