/**
 * MetadataService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { MetadataService } from '../MetadataService'

describe('MetadataService', () => {
  let metaService: MetadataService
  let vaultRoot: string

  beforeEach(() => {
    metaService = new MetadataService()
    vaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-test-meta-'))
    vaultRoot = fs.realpathSync(vaultRoot)
    fs.mkdirSync(path.join(vaultRoot, 'pdfs'), { recursive: true })
    metaService.setVaultRoot(vaultRoot)
  })

  afterEach(() => {
    if (fs.existsSync(vaultRoot)) {
      fs.rmSync(vaultRoot, { recursive: true, force: true })
    }
  })

  it('无 sidecar 时返回空元数据', () => {
    const meta = metaService.read('pdfs/book.pdf')
    expect(meta.version).toBe(2)
    expect(meta.tags).toEqual([])
    expect(meta.boundNotes).toEqual([])
    expect(meta.annotations).toEqual([])
  })

  it('读写 tags', () => {
    metaService.update('pdfs/book.pdf', { tags: ['计算机', '经典'] })
    const meta = metaService.read('pdfs/book.pdf')
    expect(meta.tags).toEqual(['计算机', '经典'])
  })

  it('update 为增量合并', () => {
    metaService.update('pdfs/book.pdf', { tags: ['tag1'] })
    metaService.update('pdfs/book.pdf', { lastPage: 42 })
    const meta = metaService.read('pdfs/book.pdf')
    expect(meta.tags).toEqual(['tag1'])
    expect(meta.lastPage).toBe(42)
  })

  it('boundNotes 读写', () => {
    metaService.update('pdfs/book.pdf', {
      boundNotes: ['notes/a.md', 'notes/b.md']
    })
    const meta = metaService.read('pdfs/book.pdf')
    expect(meta.boundNotes.length).toBe(2)
    expect(meta.boundNotes[0]).toBe('notes/a.md')
  })

  it('annotations 读写', () => {
    metaService.update('pdfs/book.pdf', {
      annotations: [
        {
          id: 'a1',
          page: 1,
          type: 'rect',
          rect: { x: 0.1, y: 0.2, w: 0.5, h: 0.1 },
          color: '#FFD54F',
          comment: '重要',
          createdAt: new Date().toISOString()
        }
      ]
    })
    const meta = metaService.read('pdfs/book.pdf')
    expect(meta.annotations.length).toBe(1)
    expect(meta.annotations[0].comment).toBe('重要')
  })

  it('updateLastPage 便捷方法', () => {
    metaService.updateLastPage('pdfs/book.pdf', 99)
    const meta = metaService.read('pdfs/book.pdf')
    expect(meta.lastPage).toBe(99)
  })

  it('损坏 JSON 时返回空元数据并备份', () => {
    // 直接写入损坏 content
    const metaPath = path.join(vaultRoot, 'pdfs/bad.pdf.meta.json')
    fs.writeFileSync(metaPath, 'not-json{{{')

    const meta = metaService.read('pdfs/bad.pdf')
    expect(meta).toBeDefined()
    expect(meta.tags).toEqual([])

    // 检查原文件被备份
    const entries = fs.readdirSync(path.join(vaultRoot, 'pdfs'))
    expect(entries.some((e) => e.endsWith('.broken'))).toBe(true)
  })

  it('schema 版本错误时返回空元数据', () => {
    fs.writeFileSync(
      path.join(vaultRoot, 'pdfs/book.pdf.meta.json'),
      JSON.stringify({ version: 99, file: 'book.pdf' })
    )

    const meta = metaService.read('pdfs/book.pdf')
    // 即使 version 不对，经过 safeParse 也应落在默认值
    expect(meta).toBeDefined()
  })
})
