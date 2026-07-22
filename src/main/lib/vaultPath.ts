/**
 * Vault 路径安全工具 — 落地红线 R6
 *
 * 所有文件操作前的强制校验点，防止路径逃逸到 Vault 根目录之外。
 * 本模块是 `assertInsideVault` 的唯一实现。
 */

import * as path from 'path'
import * as fs from 'fs'

/**
 * 校验并解析库内相对路径
 *
 * 规则：
 * - 拒绝以 '/' 或盘符开头的绝对路径
 * - 拒绝含 `..` 片段的路径
 * - 解析符号链接后再比对是否在 vaultRoot 内
 *
 * @param vaultRoot Vault 根目录绝对路径（已 resolve 且无尾部斜杠）
 * @param relPath 待校验的相对路径
 * @returns 拼接后的绝对路径
 * @throws {IpcError} code = 'E_PATH_OUTSIDE_VAULT'
 */
export function assertInsideVault(vaultRoot: string, relPath: string): string {
  // 拒绝空路径
  if (!relPath || relPath.trim().length === 0) {
    throw vaultError('E_PATH_EMPTY', '路径不能为空')
  }

  // 统一路径分隔符为当前系统格式
  const normalized = path.normalize(relPath)

  // 拒绝绝对路径
  if (path.isAbsolute(normalized)) {
    throw vaultError('E_PATH_ABSOLUTE', `不允许绝对路径: ${relPath}`)
  }

  // 拒绝 .. 逃逸
  if (normalized.includes('..')) {
    throw vaultError('E_PATH_OUTSIDE_VAULT', `路径包含非法逃逸: ${relPath}`)
  }

  // 拼接绝对路径
  const absPath = path.resolve(vaultRoot, normalized)

  // 解析符号链接后获取真实路径
  let realPath: string
  try {
    realPath = fs.realpathSync(absPath)
  } catch {
    // 文件可能还不存在（如新建笔记），使用 path.resolve 结果
    realPath = absPath
  }

  // 比对前缀：解析后的路径必须在 vaultRoot 之下
  const resolvedVault = path.resolve(vaultRoot)
  if (!realPath.startsWith(resolvedVault + path.sep) && realPath !== resolvedVault) {
    throw vaultError(
      'E_PATH_OUTSIDE_VAULT',
      `路径不在 Vault 范围内: ${relPath}` +
        `\n  期望前缀: ${resolvedVault}` +
        `\n  实际路径: ${realPath}`
    )
  }

  return absPath
}

/**
 * 将库内相对路径转为绝对路径
 * @param vaultRoot Vault 根目录绝对路径
 * @param relPath 库内相对路径
 */
export function toAbsolute(vaultRoot: string, relPath: string): string {
  return assertInsideVault(vaultRoot, relPath)
}

/**
 * 将绝对路径转为库内相对路径
 * @param vaultRoot Vault 根目录绝对路径
 * @param absPath 文件绝对路径
 * @returns 库内相对路径（使用正斜杠分隔，跨平台一致）
 */
export function toRelative(vaultRoot: string, absPath: string): string {
  const resolvedRoot = path.resolve(vaultRoot)
  const resolvedAbs = path.resolve(absPath)

  if (!resolvedAbs.startsWith(resolvedRoot + path.sep) && resolvedAbs !== resolvedRoot) {
    throw vaultError('E_PATH_OUTSIDE_VAULT', `文件不在 Vault 内: ${absPath}`)
  }

  // 使用 path.posix 确保跨平台用正斜杠
  return path.posix.relative(resolvedRoot, resolvedAbs)
}

/**
 * 判断给定路径是否在 Vault 根目录内
 */
export function isInsideVault(vaultRoot: string, testPath: string): boolean {
  try {
    assertInsideVault(vaultRoot, testPath)
    return true
  } catch {
    return false
  }
}

// ─── 私有工具 ──────────────────────────────────────

function vaultError(code: string, message: string): Error {
  const err = new Error(message) as Error & { code: string }
  err.code = code
  err.name = 'VaultPathError'
  return err
}
