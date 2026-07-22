/**
 * vaultPath 工具单元测试 — 落地红线 R6 的全部校验
 *
 * 覆盖：
 * - 正常路径解析
 * - 绝对路径拒绝
 * - .. 逃逸拒绝
 * - 符号链接逃逸拒绝
 * - toRelative 正反转换
 * - isInsideVault 判断
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { assertInsideVault, toAbsolute, toRelative, isInsideVault } from '../vaultPath'

describe('assertInsideVault', () => {
  let vaultRoot: string

  beforeEach(() => {
    vaultRoot = path.resolve(
      process.platform === 'win32' ? 'C:\\test-vault' : '/tmp/test-vault'
    )
    // 确保测试目录存在
    fs.mkdirSync(vaultRoot, { recursive: true })
    // macOS 上 /tmp → /private/tmp，resolve 不解析符号链接，
    // 后续 assertInsideVault 会调 realpathSync，所以 vaultRoot 也必须用真实路径
    vaultRoot = fs.realpathSync(vaultRoot)
  })

  afterEach(() => {
    // 清理
    if (fs.existsSync(vaultRoot)) {
      fs.rmSync(vaultRoot, { recursive: true, force: true })
    }
  })

  it('接受正常相对路径', () => {
    const result = assertInsideVault(vaultRoot, 'notes/读书笔记.md')
    expect(result).toBe(path.resolve(vaultRoot, 'notes/读书笔记.md'))
  })

  it('接受仅文件名', () => {
    const result = assertInsideVault(vaultRoot, 'readme.md')
    expect(result).toBe(path.resolve(vaultRoot, 'readme.md'))
  })

  it('接受嵌套目录', () => {
    const result = assertInsideVault(vaultRoot, 'notes/项目/设计草稿.md')
    expect(result).toBe(path.resolve(vaultRoot, 'notes/项目/设计草稿.md'))
  })

  it('接受根路径 "."', () => {
    const result = assertInsideVault(vaultRoot, '.')
    expect(result).toBe(path.resolve(vaultRoot))
  })

  it('拒绝空字符串', () => {
    expect(() => assertInsideVault(vaultRoot, '')).toThrow()
  })

  it('拒绝空白字符串', () => {
    expect(() => assertInsideVault(vaultRoot, '   ')).toThrow()
  })

  it('拒绝绝对路径', () => {
    const abs = process.platform === 'win32' ? 'C:\\outside\\file.md' : '/etc/passwd'
    expect(() => assertInsideVault(vaultRoot, abs)).toThrow()
  })

  it('拒绝 .. 逃逸', () => {
    expect(() => assertInsideVault(vaultRoot, '../outside/file.md')).toThrow()
  })

  it('拒绝 多层 .. 逃逸', () => {
    expect(() => assertInsideVault(vaultRoot, 'notes/../../etc/file.md')).toThrow()
  })

  it('拒绝 ../../ 开头', () => {
    expect(() => assertInsideVault(vaultRoot, '../../file.md')).toThrow()
  })

  it('接受 path.normalize 可消去的 ..（a/../b → b，安全）', () => {
    // path.normalize('a/../b') → 'b'，不含真正的逃逸
    const result = assertInsideVault(vaultRoot, 'a/../b')
    expect(result).toBe(path.resolve(vaultRoot, 'b'))
  })

  it('拒绝 ../../ 开头的真正逃逸', () => {
    expect(() => assertInsideVault(vaultRoot, '../../file.md')).toThrow()
  })
})

describe('符号链接逃逸检测', () => {
  let vaultRoot: string
  let outsideDir: string

  beforeEach(() => {
    vaultRoot = path.resolve(
      process.platform === 'win32' ? 'C:\\test-vault-sym' : '/tmp/test-vault-sym'
    )
    outsideDir = path.resolve(
      process.platform === 'win32' ? 'C:\\test-outside-sym' : '/tmp/test-outside-sym'
    )
    fs.mkdirSync(vaultRoot, { recursive: true })
    fs.mkdirSync(outsideDir, { recursive: true })

    // 在 outside 目录放一个哨兵文件
    fs.writeFileSync(path.join(outsideDir, 'secret.txt'), 'secret')
  })

  afterEach(() => {
    if (fs.existsSync(vaultRoot)) {
      fs.rmSync(vaultRoot, { recursive: true, force: true })
    }
    if (fs.existsSync(outsideDir)) {
      fs.rmSync(outsideDir, { recursive: true, force: true })
    }
  })

  it('拒绝指向 Vault 外部的符号链接', () => {
    const linkPath = path.join(vaultRoot, 'escape-link')
    fs.symlinkSync(outsideDir, linkPath, 'dir')

    // linkPath 在 Vault 内，但解析后指向 outside
    // assertInsideVault 应检测到并拒绝
    expect(() => assertInsideVault(vaultRoot, 'escape-link' as never)).toThrow()
  })
})

describe('toAbsolute', () => {
  const vaultRoot = path.resolve(process.platform === 'win32' ? 'C:\\my' : '/tmp/my')

  it('返回绝对路径', () => {
    const result = toAbsolute(vaultRoot, 'notes/a.md')
    expect(path.isAbsolute(result)).toBe(true)
  })

  it('传递越权路径抛错', () => {
    expect(() => toAbsolute(vaultRoot, '../oops.md')).toThrow()
  })
})

describe('toRelative', () => {
  const vaultRoot = path.resolve(process.platform === 'win32' ? 'C:\\my' : '/tmp/my')

  it('返回正斜杠相对路径', () => {
    const abs = path.resolve(vaultRoot, 'notes/a.md')
    const rel = toRelative(vaultRoot, abs)
    expect(rel).toBe('notes/a.md')
    expect(rel).not.toContain('\\')
  })

  it('Vault 外的路径抛错', () => {
    const abs = path.resolve(
      process.platform === 'win32' ? 'C:\\other\\a.md' : '/tmp/other/a.md'
    )
    expect(() => toRelative(vaultRoot, abs)).toThrow()
  })
})

describe('isInsideVault', () => {
  const vaultRoot = path.resolve(process.platform === 'win32' ? 'C:\\my' : '/tmp/my')

  it('内部路径返回 true', () => {
    expect(isInsideVault(vaultRoot, 'notes/a.md')).toBe(true)
  })

  it('外部路径返回 false', () => {
    expect(isInsideVault(vaultRoot, '../out.md')).toBe(false)
  })
})
