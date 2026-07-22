/**
 * Sidecar 元数据服务 — zod schema 校验 + 原子读写
 *
 * 红线 R4/R5 落地：PDF 原文件只读，所有写入走原子写
 *
 * 约定：pdfs/abc.pdf ↔ pdfs/abc.pdf.meta.json
 */

import * as fs from 'fs'
import * as path from 'path'
import { z } from 'zod'
import { SIDECAR_SUFFIX, META_VERSION, TMP_SUFFIX } from '../../shared/constants'
import type { PdfMeta } from '../../shared/types'

// ── Zod Schema ──────────────────────────────────────

const NormalizedRectSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1)
})

const AnnotationSchema = z.object({
  id: z.string(),
  page: z.number().int().positive(),
  type: z.enum(['rect', 'highlight']),
  rect: NormalizedRectSchema,
  color: z.string(),
  comment: z.string().default(''),
  createdAt: z.string()
})

export const PdfMetaSchema = z.object({
  version: z.number().default(META_VERSION),
  file: z.string().default(''),
  tags: z.array(z.string()).default([]),
  lastPage: z.number().int().min(0).default(0),
  boundNotes: z.array(z.string()).default([]),
  annotations: z.array(AnnotationSchema).default([]),
  updatedAt: z.string().default('')
})

// ── 服务 ────────────────────────────────────────────

export class MetadataService {
  private vaultRoot = ''

  setVaultRoot(root: string): void {
    this.vaultRoot = root
  }

  /** PDF 路径 → sidecar 路径 */
  metaPathOf(pdfRel: string): string {
    return pdfRel + SIDECAR_SUFFIX
  }

  /** 读取 sidecar，不存在或损坏时返回空元数据（不阻塞阅读） */
  read(pdfRel: string): PdfMeta {
    const absPath = path.join(this.vaultRoot, this.metaPathOf(pdfRel))

    // 不存在 → 默认空
    if (!fs.existsSync(absPath)) {
      return this.emptyMeta(pdfRel)
    }

    try {
      const raw = fs.readFileSync(absPath, 'utf-8')
      const parsed = JSON.parse(raw)
      const result = PdfMetaSchema.safeParse(parsed)

      if (!result.success) {
        // schema 校验失败 → 备份 + 返回空
        this.backupBroken(absPath)
        return this.emptyMeta(pdfRel)
      }

      // 确保 file 字段与当前 PDF 文件名一致
      const meta = result.data as PdfMeta
      meta.file = path.basename(pdfRel)
      return meta
    } catch {
      // JSON 解析失败 → 备份 + 返回空
      this.backupBroken(absPath)
      return this.emptyMeta(pdfRel)
    }
  }

  /**
   * 部分更新 sidecar（read-modify-write + 原子写）
   *
   * @param pdfRel PDF 相对路径
   * @param patch 需合并的字段（浅合并 tags/boundNotes/annotations 数组字段按替换）
   */
  update(pdfRel: string, patch: Partial<PdfMeta>): void {
    const current = this.read(pdfRel)
    const merged: PdfMeta = {
      ...current,
      ...patch,
      // 数组字段：patch 中明确传入才替换，否则保持原值
      tags: patch.tags ?? current.tags,
      boundNotes: patch.boundNotes ?? current.boundNotes,
      annotations: patch.annotations ?? current.annotations,
      updatedAt: new Date().toISOString(),
      version: META_VERSION
    }

    const metaPath = path.join(this.vaultRoot, this.metaPathOf(pdfRel))
    this.atomicWrite(metaPath, JSON.stringify(merged, null, 2))
  }

  /** 防抖写 lastPage 的便捷方法 */
  updateLastPage(pdfRel: string, page: number): void {
    // 不在此层防抖（防抖由 P-08 PdfViewer 负责），直接写
    this.update(pdfRel, { lastPage: page })
  }

  // ── 内部 ──────────────────────────────────────────

  private emptyMeta(pdfRel: string): PdfMeta {
    return {
      version: META_VERSION,
      file: path.basename(pdfRel),
      tags: [],
      lastPage: 0,
      boundNotes: [],
      annotations: [],
      updatedAt: new Date().toISOString()
    }
  }

  /** 损坏文件备份为 .broken */
  private backupBroken(absPath: string): void {
    try {
      const brokenPath = absPath + '.broken'
      fs.renameSync(absPath, brokenPath)
    } catch {
      // rename 失败也无妨（可能已经不存在）
    }
  }

  /** 原子写入（与 FileSystemService 同算法） */
  private atomicWrite(absPath: string, content: string): void {
    const dir = path.dirname(absPath)
    fs.mkdirSync(dir, { recursive: true })

    const tmpPath = absPath + TMP_SUFFIX
    fs.writeFileSync(tmpPath, content, 'utf-8')

    const fd = fs.openSync(tmpPath, 'r+')
    fs.fsyncSync(fd)
    fs.closeSync(fd)

    fs.renameSync(tmpPath, absPath)
  }
}
