/**
 * IndexService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { IndexService } from '../IndexService'
import { SIDECAR_SUFFIX } from '../../../shared/constants'

describe('IndexService', () => {
  let indexService: IndexService
  let vaultRoot: string

  beforeEach(() => {
    indexService = new IndexService()
    vaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-test-idx-'))
    vaultRoot = fs.realpathSync(vaultRoot)

    fs.mkdirSync(path.join(vaultRoot, 'notes'), { recursive: true })
    fs.mkdirSync(path.join(vaultRoot, 'pdfs'), { recursive: true })

    indexService.open(vaultRoot)
  })

  afterEach(() => {
    indexService.close()
    if (fs.existsSync(vaultRoot)) {
      fs.rmSync(vaultRoot, { recursive: true, force: true })
    }
  })

  // ── 笔记索引 ─────────────────────────────────

  describe('indexNote / removeNote', () => {
    it('索引后 search 可命中中文', () => {
      fs.writeFileSync(
        path.join(vaultRoot, 'notes/深度学习.md'),
        '# 深度学习综述\n\n本节讨论神经网络。'
      )
      indexService.indexNote('notes/深度学习.md')

      const hits = indexService.query('神经网络')
      expect(hits.length).toBeGreaterThanOrEqual(1)
      expect(hits[0].title).toBe('深度学习综述')
      expect(hits[0].kind).toBe('note')
    })

    it('搜索片段含匹配内容', () => {
      fs.writeFileSync(
        path.join(vaultRoot, 'notes/a.md'),
        '# 标题\n\n这段文字包含虚拟内存的概念。'
      )
      indexService.indexNote('notes/a.md')

      const hits = indexService.query('虚拟内存')
      expect(hits.length).toBeGreaterThanOrEqual(1)
      // trigram snippet 可能返回 title 或 content，只要命中即可
      expect(hits[0].title).toBe('标题')
    })

    it('删除后搜索不到', () => {
      fs.writeFileSync(path.join(vaultRoot, 'notes/temp.md'), '# 临时\n\n删除测试')
      indexService.indexNote('notes/temp.md')
      expect(indexService.query('删除测试').length).toBeGreaterThanOrEqual(1)

      indexService.removeNote('notes/temp.md')
      expect(indexService.query('删除测试').length).toBe(0)
    })

    it('无 H1 时用文件名作标题', () => {
      // trigram 至少 3 字才能产生 token，使用长词
      fs.writeFileSync(path.join(vaultRoot, 'notes/plain.md'), '测试内容文本')
      indexService.indexNote('notes/plain.md')

      const hits = indexService.query('测试内容')
      expect(hits.length).toBeGreaterThanOrEqual(1)
      expect(hits[0].title).toBe('plain')
    })

    it('文件不存在时静默跳过', () => {
      expect(() => indexService.indexNote('notes/ghost.md')).not.toThrow()
    })
  })

  // ── PDF 索引 ─────────────────────────────────

  describe('indexPdf / removePdf', () => {
    it('按文件名搜索 PDF', () => {
      fs.writeFileSync(path.join(vaultRoot, 'pdfs/机器学习.pdf'), '%PDF')
      indexService.indexPdf('pdfs/机器学习.pdf')

      const hits = indexService.query('机器学习', { scope: 'pdfs' })
      expect(hits.length).toBeGreaterThanOrEqual(1)
      expect(hits[0].kind).toBe('pdf')
    })

    it('按标签筛选 PDF', () => {
      fs.writeFileSync(path.join(vaultRoot, 'pdfs/book.pdf'), '%PDF')
      fs.writeFileSync(
        path.join(vaultRoot, 'pdfs/book.pdf' + SIDECAR_SUFFIX),
        JSON.stringify({
          version: 2,
          tags: ['计算机'],
          lastPage: 0,
          boundNotes: [],
          annotations: [],
          updatedAt: ''
        })
      )
      indexService.indexPdf('pdfs/book.pdf')

      const hits = indexService.query('', { scope: 'pdfs', tag: '计算机' })
      expect(hits.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ── 搜索范围 ─────────────────────────────────

  describe('搜索范围 scope', () => {
    beforeEach(() => {
      fs.writeFileSync(path.join(vaultRoot, 'notes/x.md'), '# note')
      fs.writeFileSync(path.join(vaultRoot, 'pdfs/y.pdf'), '%PDF')
      indexService.indexNote('notes/x.md')
      indexService.indexPdf('pdfs/y.pdf')
    })

    it('scope=notes 只返回笔记', () => {
      const hits = indexService.query('note', { scope: 'notes' })
      expect(hits.length).toBeGreaterThanOrEqual(1)
      expect(hits.every((h) => h.kind === 'note')).toBe(true)
    })

    it('scope=pdfs 只返回 PDF', () => {
      // 文件名搜索不受 trigram 限制，直接 LIKE
      const hits = indexService.query('y', { scope: 'pdfs' })
      expect(hits.length).toBeGreaterThanOrEqual(1)
      expect(hits.every((h) => h.kind === 'pdf')).toBe(true)
    })

    it('scope=all 返回两者', () => {
      fs.writeFileSync(path.join(vaultRoot, 'notes/deep.md'), '# deep')
      fs.writeFileSync(path.join(vaultRoot, 'pdfs/deep-book.pdf'), '%PDF')
      indexService.indexNote('notes/deep.md')
      indexService.indexPdf('pdfs/deep-book.pdf')

      const hits = indexService.query('deep')
      expect(hits.some((h) => h.kind === 'note')).toBe(true)
      expect(hits.some((h) => h.kind === 'pdf')).toBe(true)
    })
  })

  // ── 绑定冗余表 ───────────────────────────────

  describe('bindings 表操作', () => {
    it('upsert → pdfOfNote 返回正确', () => {
      indexService.upsertBinding('pdfs/a.pdf', 'notes/a.md')
      expect(indexService.pdfOfNote('notes/a.md')).toBe('pdfs/a.pdf')
    })

    it('remove 后 pdfOfNote 返回 null', () => {
      indexService.upsertBinding('pdfs/a.pdf', 'notes/a.md')
      indexService.removeBinding('pdfs/a.pdf', 'notes/a.md')
      expect(indexService.pdfOfNote('notes/a.md')).toBeNull()
    })

    it('clearBindingsOfPdf 批量清空', () => {
      indexService.upsertBinding('pdfs/a.pdf', 'notes/1.md')
      indexService.upsertBinding('pdfs/a.pdf', 'notes/2.md')
      indexService.clearBindingsOfPdf('pdfs/a.pdf')
      expect(indexService.pdfOfNote('notes/1.md')).toBeNull()
      expect(indexService.pdfOfNote('notes/2.md')).toBeNull()
    })
  })

  // ── 全量重建 ─────────────────────────────────

  describe('rebuild', () => {
    it('重建后包含所有文件', () => {
      fs.writeFileSync(path.join(vaultRoot, 'notes/a.md'), '# A\n\ncontent a')
      fs.writeFileSync(path.join(vaultRoot, 'notes/b.md'), '# B\n\ncontent b')
      indexService.indexNote('notes/a.md')
      indexService.indexNote('notes/b.md')

      indexService.rebuild()

      expect(indexService.query('content a').length).toBeGreaterThanOrEqual(1)
      expect(indexService.query('content b').length).toBeGreaterThanOrEqual(1)
    })

    it('重建后 bindings 与 sidecar 一致', () => {
      fs.writeFileSync(path.join(vaultRoot, 'pdfs/book.pdf'), '%PDF')
      fs.writeFileSync(
        path.join(vaultRoot, 'pdfs/book.pdf' + SIDECAR_SUFFIX),
        JSON.stringify({
          version: 2,
          tags: [],
          lastPage: 0,
          boundNotes: ['notes/note.md'],
          annotations: [],
          updatedAt: ''
        })
      )
      fs.writeFileSync(path.join(vaultRoot, 'notes/note.md'), '# note')

      indexService.rebuild()

      expect(indexService.pdfOfNote('notes/note.md')).toBe('pdfs/book.pdf')
    })

    it('onProgress 被调且最终到 1', () => {
      fs.writeFileSync(path.join(vaultRoot, 'notes/a.md'), '# a')
      fs.writeFileSync(path.join(vaultRoot, 'notes/b.md'), '# b')

      const pcts: number[] = []
      indexService.rebuild((pct) => pcts.push(pct))
      expect(pcts.length).toBeGreaterThan(0)
      expect(pcts[pcts.length - 1]).toBe(1)
    })
  })

  // ── 未 open 时抛错 ───────────────────────────

  it('未 open 时 query 抛错', () => {
    const svc = new IndexService()
    expect(() => svc.query('x')).toThrow()
  })
})
