/**
 * 搜索服务 — window.api.search 的领域封装
 */

import type { SearchHit, SearchOptions } from '../../shared/types'

export const searchService = {
  async query(q: string, opts?: SearchOptions): Promise<SearchHit[]> {
    return window.api.search.query(q, opts)
  },

  async rebuildIndex(): Promise<void> {
    await window.api.search.rebuildIndex()
  }
} as const
