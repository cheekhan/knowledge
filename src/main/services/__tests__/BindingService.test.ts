/**
 * BindingService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { BindingService } from '../BindingService'
import { MetadataService } from '../MetadataService'
import { FileSystemService } from '../FileSystemService'

describe('BindingService', () => {
  let bindingService: BindingService
  let metaService: MetadataService
  let fsService: FileSystemService
  let vaultRoot: string

  beforeEach(() => {
    vaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-test-bind-'))
    vaultRoot = fs.realpathSync(vaultRoot)
    fs.mkdirSync(path.join(vaultRoot, 'notes'), { recursive: true })
    fs.mkdirSync(path.join(vaultRoot, 'pdfs'), { recursive: true })

    metaService = new MetadataService()
    metaService.setVaultRoot(vaultRoot)

    fsService = new FileSystemService()
    fsService.setVaultRoot(vaultRoot)

    bindingService = new BindingService()
    bindingService.inject(vaultRoot, metaService, fsService)
  })

  afterEach(() => {
    if (fs.existsSync(vaultRoot)) {
      fs.rmSync(vaultRoot, { recursive: true, force: true })
    }
  })

  // ── createBoundNote ────────────────────────────

  describe('createBoundNote', () => {
    it('创建绑定笔记，文件存在且 sidecar 更新', () => {
      const pdfPath = 'pdfs/book.pdf'
      fs.writeFileSync(path.join(vaultRoot, pdfPath), '%PDF')

      const noteRel = bindingService.createBoundNote(pdfPath)

      // 文件存在
      expect(fs.existsSync(path.join(vaultRoot, noteRel))).toBe(true)

      // sidecar boundNotes 含新笔记
      const meta = metaService.read(pdfPath)
      expect(meta.boundNotes).toContain(noteRel)
    })

    it('笔记内容含默认标题', () => {
      const pdfPath = 'pdfs/book.pdf'
      fs.writeFileSync(path.join(vaultRoot, pdfPath), '%PDF')

      const noteRel = bindingService.createBoundNote(pdfPath)
      const content = fsService.readNote(noteRel)
      expect(content).toContain('# ')
      expect(content).toContain('book')
    })

    it('重复创建 N 递增', () => {
      const pdfPath = 'pdfs/book.pdf'
      fs.writeFileSync(path.join(vaultRoot, pdfPath), '%PDF')

      const n1 = bindingService.createBoundNote(pdfPath)
      const n2 = bindingService.createBoundNote(pdfPath)

      expect(n1).not.toBe(n2)
      expect(path.basename(n1)).not.toBe(path.basename(n2))
    })

    it('自定义文件名', () => {
      const pdfPath = 'pdfs/book.pdf'
      fs.writeFileSync(path.join(vaultRoot, pdfPath), '%PDF')

      const noteRel = bindingService.createBoundNote(pdfPath, {
        name: '自定义.md'
      })
      expect(path.basename(noteRel)).toBe('自定义.md')
    })
  })

  // ── unbind ────────────────────────────────────

  describe('unbind', () => {
    it('解绑后笔记文件保留，sidecar 移除路径', () => {
      const pdfPath = 'pdfs/book.pdf'
      fs.writeFileSync(path.join(vaultRoot, pdfPath), '%PDF')
      const noteRel = bindingService.createBoundNote(pdfPath)

      bindingService.unbind(pdfPath, noteRel)

      // 文件保留
      expect(fs.existsSync(path.join(vaultRoot, noteRel))).toBe(true)

      // sidecar 移除
      const meta = metaService.read(pdfPath)
      expect(meta.boundNotes).not.toContain(noteRel)
    })
  })

  // ── listBoundNotes ────────────────────────────

  describe('listBoundNotes', () => {
    it('列出绑定笔记含标题', () => {
      const pdfPath = 'pdfs/book.pdf'
      fs.writeFileSync(path.join(vaultRoot, pdfPath), '%PDF')
      bindingService.createBoundNote(pdfPath)

      const list = bindingService.listBoundNotes(pdfPath)
      expect(list.length).toBe(1)
      expect(list[0].title.length).toBeGreaterThan(0)
      expect(list[0].missing).toBe(false)
    })

    it('外部删除后 missing=true', () => {
      const pdfPath = 'pdfs/book.pdf'
      fs.writeFileSync(path.join(vaultRoot, pdfPath), '%PDF')
      const noteRel = bindingService.createBoundNote(pdfPath)

      // 手动删除笔记文件
      fs.unlinkSync(path.join(vaultRoot, noteRel))

      const list = bindingService.listBoundNotes(pdfPath)
      expect(list[0].missing).toBe(true)
    })
  })

  // ── pdfOfNote ────────────────────────────────

  describe('pdfOfNote', () => {
    it('可反查笔记绑定的 PDF', () => {
      const pdfPath = 'pdfs/book.pdf'
      fs.writeFileSync(path.join(vaultRoot, pdfPath), '%PDF')
      const noteRel = bindingService.createBoundNote(pdfPath)

      expect(bindingService.pdfOfNote(noteRel)).toBe(pdfPath)
    })

    it('无绑定时返回 null', () => {
      expect(bindingService.pdfOfNote('notes/ghost.md')).toBeNull()
    })
  })

  // ── repairOnRename ────────────────────────────

  describe('repairOnRename', () => {
    it('重命名笔记后 sidecar 路径更新', async () => {
      const pdfPath = 'pdfs/book.pdf'
      fs.writeFileSync(path.join(vaultRoot, pdfPath), '%PDF')
      const oldName = 'notes/old.md'
      fs.writeFileSync(path.join(vaultRoot, oldName), '# old')

      // 手动写入 sidecar 含旧路径
      metaService.update(pdfPath, { boundNotes: [oldName] })

      // 重命名
      fs.renameSync(
        path.join(vaultRoot, oldName),
        path.join(vaultRoot, 'notes/new.md')
      )

      await bindingService.repairOnRename(oldName, 'notes/new.md')

      const meta = metaService.read(pdfPath)
      expect(meta.boundNotes).toContain('notes/new.md')
      expect(meta.boundNotes).not.toContain(oldName)
    })
  })
})
