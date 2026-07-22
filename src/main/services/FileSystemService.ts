/**
 * 文件系统服务 — 原子写、CRUD、回收站删除
 *
 * 红线 R5 落地：所有落盘写操作均走 atomicWrite()
 * 红线 R6 落地：所有入参经 assertInsideVault() 校验
 *
 * 销毁钩子：renameHook 为空钩子，P-03 BindingService 注入路径修复逻辑
 */

import * as fs from 'fs'
import * as path from 'path'
import { shell } from 'electron'
import { assertInsideVault } from '../lib/vaultPath'
import { TMP_SUFFIX } from '../../shared/constants'

export type RenameHook = (oldRel: string, newRel: string) => Promise<void>

export class FileSystemService {
  private vaultRoot = ''
  /** P-03 注入的绑定路径修复钩子（P-02 期间为空实现） */
  private renameHook: RenameHook = async () => {}

  // ── 库绑定 ──────────────────────────────────────

  setVaultRoot(root: string): void {
    this.vaultRoot = path.resolve(root)
  }

  getVaultRoot(): string {
    return this.vaultRoot
  }

  /**
   * 注入重命名后的回调（P-03 调用以接入绑定路径修复）
   */
  setRenameHook(hook: RenameHook): void {
    this.renameHook = hook
  }

  // ── 原子写入 ─────────────────────────────────────

  /**
   * 原子写入文件（tmp + fsync + rename）
   *
   * 流程不会在任何时刻产生截断的原文件。
   * 崩溃最坏情况：留下一个 .tmp 文件。
   */
  atomicWrite(absPath: string, content: string): void {
    const dir = path.dirname(absPath)
    fs.mkdirSync(dir, { recursive: true })

    const tmpPath = absPath + TMP_SUFFIX
    fs.writeFileSync(tmpPath, content, 'utf-8')

    const fd = fs.openSync(tmpPath, 'r+')
    fs.fsyncSync(fd)
    fs.closeSync(fd)

    fs.renameSync(tmpPath, absPath)
  }

  // ── 笔记 CRUD ───────────────────────────────────

  /** 读取笔记全文 */
  readNote(relPath: string): string {
    const abs = assertInsideVault(this.vaultRoot, relPath)
    return fs.readFileSync(abs, 'utf-8')
  }

  /** 原子写入笔记 */
  writeNote(relPath: string, content: string): void {
    const abs = assertInsideVault(this.vaultRoot, relPath)
    this.atomicWrite(abs, content)
  }

  /** 重命名（改磁盘 → 调绑定钩子） */
  async rename(oldRelPath: string, newRelPath: string): Promise<void> {
    const oldAbs = assertInsideVault(this.vaultRoot, oldRelPath)
    const newAbs = assertInsideVault(this.vaultRoot, newRelPath)

    // 确保目标目录存在
    fs.mkdirSync(path.dirname(newAbs), { recursive: true })

    fs.renameSync(oldAbs, newAbs)

    // 通知 P-03 同步更新 sidecar boundNotes 中的路径
    await this.renameHook(oldRelPath, newRelPath)
  }

  /** 移动到目标目录 */
  async move(fromRelPath: string, toDirRel: string): Promise<void> {
    const fromAbs = assertInsideVault(this.vaultRoot, fromRelPath)
    const toDirAbs = assertInsideVault(this.vaultRoot, toDirRel)

    const basename = path.basename(fromAbs)
    const newAbs = path.resolve(toDirAbs, basename)
    // 再次校验拼接后仍在 Vault 内
    const newRel = assertInsideVault(this.vaultRoot, path.relative(this.vaultRoot, newAbs))

    fs.mkdirSync(toDirAbs, { recursive: true })
    fs.renameSync(fromAbs, newAbs)

    await this.renameHook(fromRelPath, newRel)
  }

  /** 移入系统回收站（不物理删除） */
  async delete(relPath: string): Promise<void> {
    const abs = assertInsideVault(this.vaultRoot, relPath)
    await shell.trashItem(abs)
  }

  // ── 创建 ─────────────────────────────────────────
  // 以下方法供主进程内部使用（BingingService 等），不直接暴露 IPC

  /**
   * 创建笔记文件
   * @returns 库内相对路径
   */
  createNote(parentDirRel: string, name: string, initialContent = ''): string {
    // 校验父目录安全
    assertInsideVault(this.vaultRoot, parentDirRel)
    const relPath = parentDirRel ? path.posix.join(parentDirRel, name) : name
    // 校验拼接后仍在库内
    const absPath = assertInsideVault(this.vaultRoot, relPath)
    fs.mkdirSync(path.dirname(absPath), { recursive: true })
    this.atomicWrite(absPath, initialContent)
    return relPath
  }

  /** 创建文件夹 */
  createFolder(parentDirRel: string, name: string): string {
    assertInsideVault(this.vaultRoot, parentDirRel)
    const relPath = parentDirRel ? path.posix.join(parentDirRel, name) : name
    const absPath = assertInsideVault(this.vaultRoot, relPath)
    fs.mkdirSync(absPath, { recursive: true })
    return relPath
  }

  // ── 二进制读取 ──────────────────────────────────

  /** 读取任意文件二进制数据（供 PDF 等使用） */
  readBuffer(relPath: string): Buffer {
    const abs = assertInsideVault(this.vaultRoot, relPath)
    return fs.readFileSync(abs)
  }

  /** 判断文件是否存在 */
  exists(relPath: string): boolean {
    try {
      const abs = assertInsideVault(this.vaultRoot, relPath)
      return fs.existsSync(abs)
    } catch {
      return false
    }
  }

  /** 判断路径是否为目录 */
  isDirectory(relPath: string): boolean {
    const abs = assertInsideVault(this.vaultRoot, relPath)
    try {
      return fs.statSync(abs).isDirectory()
    } catch {
      return false
    }
  }
}
