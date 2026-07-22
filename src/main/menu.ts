/**
 * 原生菜单构建
 *
 * macOS 要求必须有 App 菜单（否则窗口按钮行为异常），
 * Windows 则显示标准菜单栏。
 */

import { Menu, app, BrowserWindow } from 'electron'

export function createMenu(): void {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    // macOS 专用 App 菜单
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const, label: '关于' },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const, label: '隐藏' },
              { role: 'hideOthers' as const, label: '隐藏其他' },
              { role: 'unhide' as const, label: '全部显示' },
              { type: 'separator' as const },
              { role: 'quit' as const, label: '退出' }
            ]
          } as Electron.MenuItemConstructorOptions
        ]
      : []),

    // 文件
    {
      label: '文件',
      submenu: [
        {
          label: '打开库...',
          accelerator: 'CmdOrCtrl+O',
          click: (_menuItem, browserWindow) => {
            const bw = browserWindow as BrowserWindow | undefined
            bw?.webContents.send('menu:open-vault')
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close', label: '关闭窗口' } : { role: 'quit', label: '退出' }
      ]
    },

    // 编辑
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },

    // 视图
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },

    // 窗口 (macOS)
    ...(isMac
      ? [
          {
            label: '窗口',
            submenu: [
              { role: 'minimize', label: '最小化' },
              { role: 'zoom', label: '缩放' },
              { role: 'front', label: '前置全部窗口' }
            ]
          } as Electron.MenuItemConstructorOptions
        ]
      : []),

    // 帮助
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 KnowledgeBase',
          click: () => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) {
              win.webContents.send('menu:about')
            }
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
