/**
 * Vault 状态 — 文件树 + 选中 + 展开目录
 */

import { create } from 'zustand'
import type { FileTreeNode, VaultSummary } from '../../shared/types'

interface VaultState {
  vaultPath: string | null
  tree: FileTreeNode[]
  selectedPath: string | null
  expandedDirs: Set<string>

  setVault(summary: VaultSummary): void
  setTree(tree: FileTreeNode[]): void
  selectNode(path: string): void
  toggleDir(path: string): void
  setExpandedDirs(dirs: Set<string>): void
  clear(): void
}

export const useVaultStore = create<VaultState>((set) => ({
  vaultPath: null,
  tree: [],
  selectedPath: null,
  expandedDirs: new Set(),

  setVault(summary) {
    set({
      vaultPath: summary.rootPath,
      tree: summary.tree,
      selectedPath: null,
      expandedDirs: new Set()
    })
  },

  setTree(tree) {
    set({ tree })
  },

  selectNode(path) {
    set({ selectedPath: path })
  },

  toggleDir(path) {
    set((state) => {
      const next = new Set(state.expandedDirs)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return { expandedDirs: next }
    })
  },

  setExpandedDirs(dirs) {
    set({ expandedDirs: new Set(dirs) })
  },

  clear() {
    set({
      vaultPath: null,
      tree: [],
      selectedPath: null,
      expandedDirs: new Set()
    })
  }
}))
