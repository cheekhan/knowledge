/**
 * Preload 脚本 — contextBridge 安全暴露 window.api
 *
 * 红线 R1 落地：渲染进程只能通过 window.api 与主进程通信。
 *
 * 设计：
 * - invoke 型 IPC：用 ipcRenderer.invoke，返回 Promise
 * - 事件型 IPC：用 ipcRenderer.on/removeListener，返回 unsubscribe 函数
 * - 所有类型来自 shared/ipc-contract.ts 的 IpcApi 接口
 */

import { contextBridge, ipcRenderer } from 'electron'
import type { IpcApi } from '../shared/ipc-contract'
import type { VaultChangeEvent, UpdateStatus, Unsubscribe } from '../shared/types'
import { EVENT_VAULT_CHANGED, EVENT_NOTE_EXTERNALLY_MODIFIED } from '../shared/constants'

/**
 * 暴露到渲染进程 window.api 的 APIs
 *
 * 重要：此处按 IpcApi 接口逐字段实现，保证编译期类型对不上的问题立即暴露。
 */
const api: IpcApi = {
  // ── vault ────────────────────────────────────────
  vault: {
    open: (path) => ipcRenderer.invoke('vault:open', path),
    getTree: () => ipcRenderer.invoke('vault:getTree'),
    getRecent: () => ipcRenderer.invoke('vault:getRecent'),
    browseFolder: () => ipcRenderer.invoke('dialog:openVault'),
    onVaultChanged: (cb: (event: VaultChangeEvent) => void): Unsubscribe => {
      const handler = (_event: Electron.IpcRendererEvent, payload: VaultChangeEvent) => cb(payload)
      ipcRenderer.on(EVENT_VAULT_CHANGED, handler)
      return () => ipcRenderer.removeListener(EVENT_VAULT_CHANGED, handler)
    }
  },

  // ── note ─────────────────────────────────────────
  note: {
    read: (relPath) => ipcRenderer.invoke('note:read', relPath),
    write: (relPath, content) => ipcRenderer.invoke('note:write', relPath, content),
    rename: (oldPath, newPath) => ipcRenderer.invoke('note:rename', oldPath, newPath),
    move: (fromPath, toDir) => ipcRenderer.invoke('note:move', fromPath, toDir),
    delete: (relPath) => ipcRenderer.invoke('note:delete', relPath),
    onExternallyModified: (cb): Unsubscribe => {
      const handler = (_event: Electron.IpcRendererEvent, relPath: string) => cb(relPath)
      ipcRenderer.on(EVENT_NOTE_EXTERNALLY_MODIFIED, handler)
      return () => ipcRenderer.removeListener(EVENT_NOTE_EXTERNALLY_MODIFIED, handler)
    }
  },

  // ── pdf ──────────────────────────────────────────
  pdf: {
    readBuffer: (relPath) => ipcRenderer.invoke('pdf:readBuffer', relPath),
    getMeta: (relPath) => ipcRenderer.invoke('pdf:getMeta', relPath),
    updateMeta: (relPath, patch) => ipcRenderer.invoke('pdf:updateMeta', relPath, patch),
    listByTag: (tag) => ipcRenderer.invoke('pdf:listByTag', tag)
  },

  // ── binding ──────────────────────────────────────
  binding: {
    createBoundNote: (pdfPath, opts) =>
      ipcRenderer.invoke('binding:createBoundNote', pdfPath, opts),
    unbind: (pdfPath, notePath) => ipcRenderer.invoke('binding:unbind', pdfPath, notePath),
    listBoundNotes: (pdfPath) => ipcRenderer.invoke('binding:listBoundNotes', pdfPath),
    pdfOfNote: (notePath) => ipcRenderer.invoke('binding:pdfOfNote', notePath)
  },

  // ── asset ────────────────────────────────────────
  asset: {
    save: (filename, buffer) => ipcRenderer.invoke('asset:save', filename, buffer)
  },

  // ── settings ─────────────────────────────────────
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (patch) => ipcRenderer.invoke('settings:update', patch),
    getRecentVaults: () => ipcRenderer.invoke('settings:getRecentVaults'),
    addRecentVault: (vaultPath) => ipcRenderer.invoke('settings:addRecentVault', vaultPath)
  },

  // ── window ───────────────────────────────────────
  window: {
    showInFolder: (relPath) => ipcRenderer.invoke('window:showInFolder', relPath),
    revealVaultInOs: () => ipcRenderer.invoke('window:revealVaultInOs')
  },

  // ── search ───────────────────────────────────────
  search: {
    query: (q, opts) => ipcRenderer.invoke('search:query', q, opts),
    rebuildIndex: () => ipcRenderer.invoke('search:rebuildIndex')
  },

  // ── update ───────────────────────────────────────
  update: {
    checkForUpdates: () => ipcRenderer.invoke('update:checkForUpdates'),
    downloadAndInstall: () => ipcRenderer.invoke('update:downloadAndInstall'),
    quitAndInstall: () => ipcRenderer.invoke('update:quitAndInstall'),
    onUpdateStatus: (cb): Unsubscribe => {
      const handler = (_event: Electron.IpcRendererEvent, status: UpdateStatus) => cb(status)
      ipcRenderer.on('update:status', handler)
      return () => ipcRenderer.removeListener('update:status', handler)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
