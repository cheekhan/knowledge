/**
 * FileSystemService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { FileSystemService } from '../FileSystemService'

describe('FileSystemService', () => {
  let fsService: FileSystemService
  let vaultRoot: string

  beforeEach(() => {
    fsService = new FileSystemService()
    vaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-test-fs-'))
    vaultRoot = fs.realpathSync(vaultRoot)
    fsService.setVaultRoot(vaultRoot)
    // 创建基本目录结构
    fs.mkdirSync(path.join(vaultRoot, 'notes'), { recursive: true })
    fs.mkdirSync(path.join(vaultRoot, 'pdfs'), { recursive: true })
  })

  afterEach(() => {
    if (fs.existsSync(vaultRoot)) {
      fs.rmSync(vaultRoot, { recursive: true, force: true })
    }
  })

  // ── 原子写入 ─────────────────────────────────

  describe('atomicWrite', () => {
    it('写入后内容一致', () => {
      const absPath = path.join(vaultRoot, 'notes', 'test.md')
      fsService.atomicWrite(absPath, '# Hello')
      const content = fs.readFileSync(absPath, 'utf-8')
      expect(content).toBe('# Hello')
    })

    it('不遗留 .tmp 文件', () => {
      const absPath = path.join(vaultRoot, 'notes', 'test.md')
      fsService.atomicWrite(absPath, '# Hello')
      expect(fs.existsSync(absPath + '.tmp')).toBe(false)
    })
  })

  // ── 读写笔记 ─────────────────────────────────

  describe('readNote / writeNote', () => {
    it('写后读回一致', () => {
      fsService.writeNote('notes/hello.md', '# 测试笔记')
      const content = fsService.readNote('notes/hello.md')
      expect(content).toBe('# 测试笔记')
    })

    it('覆盖写正确', () => {
      fsService.writeNote('notes/t.md', 'v1')
      fsService.writeNote('notes/t.md', 'v2')
      expect(fsService.readNote('notes/t.md')).toBe('v2')
    })
  })

  // ── 路径安全 ─────────────────────────────────

  describe('路径越权校验', () => {
    it('拒绝 .. 逃逸写入', () => {
      expect(() => fsService.writeNote('../outside.md', 'evil')).toThrow()
    })

    it('拒绝绝对路径', () => {
      expect(() => fsService.writeNote('/etc/passwd', 'x')).toThrow()
    })

    it('接受正常嵌套路径', () => {
      fsService.writeNote('notes/a/b/c.md', 'deep')
      expect(fsService.readNote('notes/a/b/c.md')).toBe('deep')
    })
  })

  // ── 重命名 ───────────────────────────────────

  describe('rename', () => {
    it('重命名后旧路径不存在', async () => {
      fsService.writeNote('notes/old.md', 'x')
      await fsService.rename('notes/old.md', 'notes/new.md')
      expect(fs.existsSync(path.join(vaultRoot, 'notes/old.md'))).toBe(false)
      expect(fs.existsSync(path.join(vaultRoot, 'notes/new.md'))).toBe(true)
    })

    it('内容保持不变', async () => {
      fsService.writeNote('notes/a.md', 'the content')
      await fsService.rename('notes/a.md', 'notes/b.md')
      expect(fsService.readNote('notes/b.md')).toBe('the content')
    })

    it('重命名钩子被调用', async () => {
      fsService.writeNote('notes/a.md', 'x')
      let called = false
      fsService.setRenameHook(async (oldRel, newRel) => {
        called = true
        expect(oldRel).toBe('notes/a.md')
        expect(newRel).toBe('notes/b.md')
      })
      await fsService.rename('notes/a.md', 'notes/b.md')
      expect(called).toBe(true)
    })
  })

  // ── 移动 ─────────────────────────────────────

  describe('move', () => {
    it('移动到其他目录', async () => {
      fsService.writeNote('notes/a.md', 'x')
      await fsService.move('notes/a.md', 'pdfs')
      expect(fs.existsSync(path.join(vaultRoot, 'pdfs/a.md'))).toBe(true)
      expect(fs.existsSync(path.join(vaultRoot, 'notes/a.md'))).toBe(false)
    })
  })

  // ── 创建 ─────────────────────────────────────

  describe('createNote / createFolder', () => {
    it('创建笔记文件并返回相对路径', () => {
      const rel = fsService.createNote('notes', '新笔记.md', '# 标题')
      expect(rel).toContain('新笔记.md')
      expect(fsService.readNote(rel)).toBe('# 标题')
    })

    it('创建文件夹', () => {
      const rel = fsService.createFolder('notes', '子目录')
      expect(fs.existsSync(path.join(vaultRoot, rel))).toBe(true)
      expect(fs.statSync(path.join(vaultRoot, rel)).isDirectory()).toBe(true)
    })
  })

  // ── 二进制读取 ───────────────────────────────

  describe('readBuffer', () => {
    it('读取二进制文件', () => {
      const relPath = 'notes/data.bin'
      const absPath = path.join(vaultRoot, relPath)
      fs.writeFileSync(absPath, Buffer.from([0x00, 0x01, 0x02]))
      const buf = fsService.readBuffer(relPath)
      expect(Buffer.isBuffer(buf)).toBe(true)
      expect(buf.length).toBe(3)
    })
  })

  // ── 存在性检查 ──────────────────────────────

  describe('exists / isDirectory', () => {
    it('存在返回 true', () => {
      fsService.writeNote('notes/x.md', 'x')
      expect(fsService.exists('notes/x.md')).toBe(true)
    })

    it('不存在返回 false', () => {
      expect(fsService.exists('notes/nope.md')).toBe(false)
    })

    it('判断目录', () => {
      expect(fsService.isDirectory('notes')).toBe(true)
      expect(fsService.isDirectory('notes/x.md')).toBe(false)
    })
  })
})
