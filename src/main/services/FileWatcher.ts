/**
 * 文件监听服务 — chokidar 封装
 *
 * 职责：
 * - watch(vaultRoot)：启动递归监听，忽略 .kb/ 与隐藏文件
 * - 100ms 防抖合并高频事件
 * - 归一化为 VaultChangeEvent 回调
 * - 维护当前打开的笔记集合（编辑器上报 dirty 状态），外部修改时推送恰当事件
 */

import chokidar from 'chokidar'
import * as path from 'path'
import type { VaultChangeEvent, VaultChangeEventType } from '../../shared/types'
import { KB_DIR } from '../../shared/constants'
import { toRelative } from '../lib/vaultPath'

/** 事件防抖窗口（ms） */
const DEBOUNCE_MS = 100

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null
  private vaultRoot = ''
  private onChange: (event: VaultChangeEvent) => void = () => {}

  // ── 打开的文件集合（用于外部修改冲突判断） ──

  /** 当前在编辑器中打开的笔记路径（相对路径） → 是否有未保存更改 */
  private openFiles = new Map<string, boolean>()

  /**
   * 开始监听
   */
  watch(
    vaultRoot: string,
    onChange: (event: VaultChangeEvent) => void
  ): void {
    this.vaultRoot = path.resolve(vaultRoot)
    this.onChange = onChange

    const kbDir = path.join(this.vaultRoot, KB_DIR)

    this.watcher = chokidar.watch(this.vaultRoot, {
      ignoreInitial: true,
      ignored: [
        /(^|[\\/])\.[^\\/]/,
        '**/*.tmp',
        kbDir
      ],
      depth: 99, // chokidar 2.x 兼容；v3 默认无限
      persistent: true
    })

    // 每个文件路径的防抖定时器
    const debounceMap = new Map<string, NodeJS.Timeout>()

    const emit = (type: VaultChangeEventType, absPath: string, oldAbsPath?: string) => {
      const relPath = toRelative(this.vaultRoot, absPath)
      const oldRelPath = oldAbsPath ? toRelative(this.vaultRoot, oldAbsPath) : undefined

      // 滤掉 .kb/ 内的事件
      if (relPath.startsWith(KB_DIR + '/') || relPath === KB_DIR) {
        return
      }

      // 防抖：同路径同类型 100ms 内覆盖
      const debounceKey = `${type}:${relPath}`
      clearTimeout(debounceMap.get(debounceKey))
      debounceMap.set(
        debounceKey,
        setTimeout(() => {
          debounceMap.delete(debounceKey)
          this.onChange({ type, relPath, oldPath: oldRelPath })
        }, DEBOUNCE_MS)
      )
    }

    // ── 事件绑定 ──────────────────────────────

    this.watcher.on('add', (absPath: string) => {
      emit('add', absPath)
    })

    this.watcher.on('change', (absPath: string) => {
      emit('change', absPath)
    })

    this.watcher.on('unlink', (absPath: string) => {
      emit('unlink', absPath)
      // 清理内部状态
      const relPath = toRelative(this.vaultRoot, absPath)
      this.openFiles.delete(relPath)
    })

    this.watcher.on('addDir', (absPath: string) => {
      emit('addDir', absPath)
    })

    this.watcher.on('unlinkDir', (absPath: string) => {
      emit('unlinkDir', absPath)
    })
  }

  /** 停止监听 */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
    this.openFiles.clear()
  }

  /** 当前是否在监听 */
  isWatching(): boolean {
    return this.watcher !== null
  }

  // ── 打开文件状态管理 ──────────────────────────────

  /**
   * 编辑器打开文件时调用
   */
  markOpen(relPath: string): void {
    this.openFiles.set(relPath, false)
  }

  /**
   * 编辑器关闭文件时调用
   */
  markClosed(relPath: string): void {
    this.openFiles.delete(relPath)
  }

  /**
   * 编辑器上报脏状态变更
   */
  setDirty(relPath: string, isDirty: boolean): void {
    this.openFiles.set(relPath, isDirty)
  }

  /**
   * 查询文件是否处于打开且未保存状态
   */
  isDirty(relPath: string): boolean {
    return this.openFiles.get(relPath) === true
  }
}
