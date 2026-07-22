/**
 * 渲染进程类型声明
 */

/// <reference types="vite/client" />

import type { IpcApi } from '../shared/ipc-contract'

declare global {
  interface Window {
    /** 主进程暴露的 IPC 接口（P-01 冻结） */
    api: IpcApi
  }
}

export {}
