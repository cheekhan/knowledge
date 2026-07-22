import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

/**
 * electron-vite v5 配置
 *
 * - main / preload: externalizeDepsPlugin 已内置为默认行为，不需手动注册
 * - better-sqlite3 等原生模块自动 external 化
 * - renderer: 标准 Vite React 配置
 */
export default defineConfig({
  main: {
    plugins: []
  },
  preload: {
    plugins: []
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer')
      }
    },
    plugins: [react()]
  }
})
