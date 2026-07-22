import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

/**
 * electron-vite v5 配置
 *
 * - main / preload: externalizeDepsPlugin 已内置为默认行为，不需手动注册
 * - better-sqlite3 等原生模块自动 external 化
 * - renderer: 标准 Vite React 配置
 * - builderOptions: 分包策略（pdfjs / codemirror / mermaid）
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
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            pdfjs: ['pdfjs-dist'],
            codemirror: ['@codemirror/view', '@codemirror/state', '@codemirror/lang-markdown'],
            mermaid: ['mermaid']
          }
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    optimizeDeps: {
      include: ['pdfjs-dist']
    }
  }
})
