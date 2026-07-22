/**
 * 文件树面板 — 递归节点 + 绑定笔记子节点
 */

import React, { useMemo, useCallback } from 'react'
import { useVaultStore } from '../../stores/vault.store'
import { useWorkspaceStore } from '../../stores/workspace.store'
import type { FileTreeNode } from '../../../shared/types'

/** 扁平化节点（含深度，供渲染用） */
interface FlatNode {
  node: FileTreeNode
  depth: number
}

const FileTree: React.FC = () => {
  const tree = useVaultStore((s) => s.tree)
  const expandedDirs = useVaultStore((s) => s.expandedDirs)
  const selectedPath = useVaultStore((s) => s.selectedPath)
  const selectNode = useVaultStore((s) => s.selectNode)
  const toggleDir = useVaultStore((s) => s.toggleDir)
  const openNote = useWorkspaceStore((s) => s.openNote)
  const openPdf = useWorkspaceStore((s) => s.openPdf)
  const openSplit = useWorkspaceStore((s) => s.openSplit)

  // ── 扁平化树 ─────────────────────────────────

  const flatNodes = useMemo(() => {
    const result: FlatNode[] = []
    const walk = (nodes: FileTreeNode[], depth: number) => {
      for (const node of nodes) {
        result.push({ node, depth })
        if (node.kind === 'folder' && expandedDirs.has(node.path) && node.children) {
          walk(node.children, depth + 1)
        }
        // PDF 绑定笔记子节点
        if (node.kind === 'pdf' && node.boundNotes && node.boundNotes.length > 0) {
          for (const bn of node.boundNotes) {
            result.push({
              node: {
                path: bn.notePath,
                name: bn.title || bn.notePath,
                kind: 'note'
              },
              depth: depth + 1
            })
          }
        }
      }
    }
    walk(tree, 0)
    return result
  }, [tree, expandedDirs])

  // ── 点击处理 ─────────────────────────────────

  const handleClick = useCallback(
    (node: FileTreeNode) => {
      selectNode(node.path)

      if (node.kind === 'folder') {
        toggleDir(node.path)
        return
      }

      if (node.kind === 'note') {
        const pdfPath = findBoundPdfOf(node.path, tree)
        if (pdfPath) {
          openSplit(pdfPath, node.path)
          return
        }
        openNote(node.path)
        return
      }

      if (node.kind === 'pdf') {
        openPdf(node.path)
        return
      }
    },
    [selectNode, toggleDir, openNote, openPdf, openSplit, tree]
  )

  // ── 渲染 ─────────────────────────────────────

  if (tree.length === 0) {
    return (
      <div style={styles.empty}>暂无文件，打开一个库开始使用</div>
    )
  }

  return (
    <div style={styles.container}>
      {flatNodes.map(({ node, depth }, index) => {
        const isSelected = selectedPath === node.path
        const isBoundChild = Boolean(findBoundPdfOf(node.path, tree))

        return (
          <div
            key={node.path + '-' + index}
            style={{
              ...styles.row,
              paddingLeft: 16 + depth * 16,
              backgroundColor: isSelected ? 'var(--bg-active)' : 'transparent'
            }}
            onClick={() => handleClick(node)}
            onContextMenu={(e) => {
              e.preventDefault()
              selectNode(node.path)
            }}
          >
            {/* 展开/折叠箭头 */}
            {node.kind === 'folder' && (
              <span style={styles.arrow}>
                {expandedDirs.has(node.path) ? '▾' : '▸'}
              </span>
            )}

            {/* 图标 */}
            <span style={styles.icon}>
              {node.kind === 'folder'
                ? expandedDirs.has(node.path) ? '📂' : '📁'
                : node.kind === 'pdf'
                  ? '📄'
                  : isBoundChild
                    ? '🔗'
                    : '📝'}
            </span>

            {/* 名称 */}
            <span
              style={{
                ...styles.name,
                opacity: isBoundChild ? 0.7 : 1,
                fontStyle: isBoundChild ? 'italic' : 'normal'
              }}
            >
              {node.name}
            </span>

            {/* missing / 绑定标识 */}
            {isBoundChild && (
              <span style={styles.badge}>绑定</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── 辅助 ──────────────────────────────────────────

function findBoundPdfOf(
  notePath: string,
  tree: FileTreeNode[]
): string | null {
  for (const node of tree) {
    if (node.kind === 'pdf' && node.boundNotes?.some((bn) => bn.notePath === notePath)) {
      return node.path
    }
    if (node.children) {
      const found = findBoundPdfOf(notePath, node.children)
      if (found) return found
    }
  }
  return null
}

// ── 样式 ──────────────────────────────────────────

const ROW_H = 30

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    overflowY: 'auto',
    overflowX: 'hidden'
  },
  empty: {
    padding: '24px 16px',
    fontSize: '13px',
    color: 'var(--text-tertiary)',
    textAlign: 'center'
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    height: ROW_H,
    cursor: 'pointer',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    fontSize: '13px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    transition: 'background-color 0.1s',
    paddingRight: 12
  },
  arrow: {
    width: 14,
    fontSize: '10px',
    color: 'var(--text-tertiary)',
    flexShrink: 0
  },
  icon: {
    width: 18,
    fontSize: '13px',
    flexShrink: 0,
    textAlign: 'center'
  },
  name: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  badge: {
    fontSize: '10px',
    padding: '1px 5px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-tertiary)',
    flexShrink: 0
  }
}

export default FileTree
