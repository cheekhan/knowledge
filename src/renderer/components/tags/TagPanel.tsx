import React, { useEffect, useState, useCallback } from 'react'
import { useVaultStore } from '../../stores/vault.store'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { pdfService } from '../../services/pdf.service'
import type { FileTreeNode } from '../../../shared/types'

interface TagEntry {
  tag: string
  pdfPaths: string[]
}

const TagPanel: React.FC = () => {
  const tree = useVaultStore((s) => s.tree)
  const openPdf = useWorkspaceStore((s) => s.openPdf)

  const [tags, setTags] = useState<TagEntry[]>([])
  const [expandedTag, setExpandedTag] = useState<string | null>(null)
  const [expandedPdfs, setExpandedPdfs] = useState<string[]>([])

  // 收集树中所有 PDF 的标签
  useEffect(() => {
    const collect = async () => {
      const pdfs: FileTreeNode[] = []
      const walk = (nodes: FileTreeNode[]) => {
        for (const n of nodes) {
          if (n.kind === 'pdf') pdfs.push(n)
          if (n.children) walk(n.children)
        }
      }
      walk(tree)

      if (pdfs.length === 0) {
        setTags([])
        return
      }

      // 聚合所有标签
      const tagMap = new Map<string, string[]>()
      for (const pdf of pdfs) {
        try {
          const meta = await pdfService.getMeta(pdf.path)
          for (const t of meta.tags) {
            const list = tagMap.get(t)
            if (list) list.push(pdf.path)
            else tagMap.set(t, [pdf.path])
          }
        } catch {
          // 无 sidecar 或读取失败 → 跳过
        }
      }

      const entries: TagEntry[] = Array.from(tagMap.entries())
        .map(([tag, pdfPaths]) => ({ tag, pdfPaths }))
        .sort((a, b) => a.tag.localeCompare(b.tag))

      setTags(entries)
    }

    collect()
  }, [tree])

  // 点击标签 → 展开/折叠该标签下的 PDF 列表
  const handleTagClick = useCallback(async (tag: string) => {
    if (expandedTag === tag) {
      setExpandedTag(null)
      setExpandedPdfs([])
      return
    }
    setExpandedTag(tag)
    try {
      const pdfs = await pdfService.listByTag(tag)
      setExpandedPdfs(pdfs)
    } catch {
      setExpandedPdfs([])
    }
  }, [expandedTag])

  return (
    <div style={S.panel}>
      <div style={S.header}>标签</div>
      {tags.length === 0 ? (
        <div style={S.empty}>打开 PDF 添加标签</div>
      ) : (
        <div style={S.list}>
          {tags.map(({ tag, pdfPaths }) => (
            <div key={tag}>
              <div
                onClick={() => handleTagClick(tag)}
                style={{
                  ...S.tagItem,
                  backgroundColor: expandedTag === tag ? 'var(--bg-active)' : 'transparent'
                }}
              >
                <span style={S.tagName}>{tag}</span>
                <span style={S.tagCount}>{pdfPaths.length}</span>
              </div>
              {/* 展开后显示 PDF 列表 */}
              {expandedTag === tag && (
                <div style={S.pdfList}>
                  {expandedPdfs.length === 0 ? (
                    <div style={S.pdfItemMuted}>加载中…</div>
                  ) : (
                    expandedPdfs.map((pdfPath) => (
                      <div
                        key={pdfPath}
                        onClick={(e) => {
                          e.stopPropagation()
                          openPdf(pdfPath)
                        }}
                        style={S.pdfItem}
                        title={pdfPath}
                      >
                        {pdfPath.split('/').pop()?.replace('.pdf', '') ?? pdfPath}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const S = {
  panel: {
    padding: '8px 0',
    borderTop: '1px solid var(--border-secondary)'
  } as React.CSSProperties,
  header: {
    padding: '4px 16px 6px',
    fontSize: 11,
    color: 'var(--text-tertiary)',
    fontWeight: 500
  } as React.CSSProperties,
  empty: {
    padding: '8px 16px',
    fontSize: 12,
    color: 'var(--text-tertiary)'
  } as React.CSSProperties,
  list: {
    maxHeight: 200,
    overflowY: 'auto' as const
  },
  tagItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 16px',
    cursor: 'pointer',
    userSelect: 'none' as const,
    WebkitUserSelect: 'none' as const,
    fontSize: 12,
    color: 'var(--text-secondary)'
  } as React.CSSProperties,
  tagName: {} as React.CSSProperties,
  tagCount: {
    fontSize: 10,
    color: 'var(--text-tertiary)',
    backgroundColor: 'var(--bg-hover)',
    padding: '1px 5px',
    borderRadius: 8
  } as React.CSSProperties,
  pdfList: {
    paddingLeft: 16
  } as React.CSSProperties,
  pdfItem: {
    padding: '2px 16px 2px 24px',
    fontSize: 11,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    overflow: 'hidden',
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
    userSelect: 'none' as const,
    WebkitUserSelect: 'none' as const
  } as React.CSSProperties,
  pdfItemMuted: {
    padding: '2px 16px 2px 24px',
    fontSize: 11,
    color: 'var(--text-tertiary)'
  } as React.CSSProperties
}

export default TagPanel
