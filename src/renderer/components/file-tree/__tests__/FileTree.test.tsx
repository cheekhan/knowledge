/**
 * FileTree 组件测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import React from 'react'
import FileTree from '../FileTree'
import { useVaultStore } from '../../../stores/vault.store'
import { useWorkspaceStore } from '../../../stores/workspace.store'

describe('FileTree', () => {
  beforeEach(() => {
    useVaultStore.setState({
      vaultPath: '/test/vault',
      tree: [],
      selectedPath: null,
      expandedDirs: new Set()
    })
    useWorkspaceStore.setState({ dock: null })
  })

  it('空树渲染空提示', () => {
    render(<FileTree />)
    expect(screen.getByText(/暂无文件/)).toBeTruthy()
  })

  it('渲染笔记节点', () => {
    useVaultStore.setState({
      tree: [{ path: 'notes/a.md', name: 'a.md', kind: 'note' }]
    })
    render(<FileTree />)
    expect(screen.getByText('a.md')).toBeTruthy()
  })

  it('渲染目录节点', () => {
    useVaultStore.setState({
      tree: [
        {
          path: 'notes',
          name: 'notes',
          kind: 'folder',
          children: [
            { path: 'notes/b.md', name: 'b.md', kind: 'note' }
          ]
        }
      ]
    })
    render(<FileTree />)
    expect(screen.getByText('notes')).toBeTruthy()
    // 未展开时子节点不可见
    expect(screen.queryByText('b.md')).toBeNull()
  })

  it('展开目录后显示子节点', () => {
    useVaultStore.setState({
      tree: [
        {
          path: 'notes',
          name: 'notes',
          kind: 'folder',
          children: [
            { path: 'notes/b.md', name: 'b.md', kind: 'note' }
          ]
        }
      ],
      expandedDirs: new Set(['notes'])
    })
    render(<FileTree />)
    expect(screen.getByText('b.md')).toBeTruthy()
  })

  it('渲染 PDF 及绑定笔记子节点', () => {
    useVaultStore.setState({
      tree: [
        {
          path: 'pdfs/book.pdf',
          name: 'book.pdf',
          kind: 'pdf',
          boundNotes: [
            { notePath: 'notes/note.md', title: '读书笔记', missing: false }
          ]
        }
      ]
    })
    render(<FileTree />)
    expect(screen.getByText('book.pdf')).toBeTruthy()
    expect(screen.getByText('读书笔记')).toBeTruthy()
  })

  it('点击笔记触发 openNote', () => {
    useVaultStore.setState({
      tree: [{ path: 'notes/a.md', name: 'a.md', kind: 'note' }]
    })
    render(<FileTree />)
    fireEvent.click(screen.getByText('a.md'))
    expect(useVaultStore.getState().selectedPath).toBe('notes/a.md')
    expect(useWorkspaceStore.getState().dock?.mode).toBe('note')
  })

  it('点击 PDF 触发 openPdf', () => {
    useVaultStore.setState({
      tree: [{ path: 'pdfs/book.pdf', name: 'book.pdf', kind: 'pdf' }]
    })
    render(<FileTree />)
    fireEvent.click(screen.getByText('book.pdf'))
    expect(useWorkspaceStore.getState().dock?.mode).toBe('pdf')
  })

  it('点击绑定笔记触发 openSplit', () => {
    useVaultStore.setState({
      tree: [
        {
          path: 'pdfs/book.pdf',
          name: 'book.pdf',
          kind: 'pdf',
          boundNotes: [
            { notePath: 'notes/note.md', title: '笔记', missing: false }
          ]
        }
      ]
    })
    render(<FileTree />)
    fireEvent.click(screen.getByText('笔记'))
    const dock = useWorkspaceStore.getState().dock
    expect(dock?.mode).toBe('split')
    if (dock?.mode === 'split') {
      expect(dock.notePath).toBe('notes/note.md')
    }
  })
})
