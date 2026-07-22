import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { KB_DIR, APP_CONFIG_FILENAME, RECENT_VAULTS_FILENAME, RECENT_VAULTS_MAX, TMP_SUFFIX } from '../../shared/constants'
import type { AppSettings, RecentVaultEntry } from '../../shared/types'

const defaults: AppSettings = { theme: 'system', editorFontSize: 15, autoSaveIntervalMs: 1000 }

export class SettingsService {
  private vaultRoot = ''
  private cache: AppSettings | null = null

  setVaultRoot(root: string): void { this.vaultRoot = root; this.cache = null }

  get(): AppSettings {
    if (this.cache) return this.cache
    try {
      const p = this.configPath()
      if (!fs.existsSync(p)) return defaults
      this.cache = { ...defaults, ...JSON.parse(fs.readFileSync(p, 'utf-8')) }
      return this.cache!
    } catch { return defaults }
  }

  update(patch: Partial<AppSettings>): void {
    const cur = this.get()
    const merged = { ...cur, ...patch }
    this.cache = merged
    const p = this.configPath()
    fs.mkdirSync(path.dirname(p), { recursive: true })
    const tmp = p + TMP_SUFFIX
    fs.writeFileSync(tmp, JSON.stringify(merged, null, 2), 'utf-8')
    const fd = fs.openSync(tmp, 'r+'); fs.fsyncSync(fd); fs.closeSync(fd)
    fs.renameSync(tmp, p)
  }

  getRecentVaults(): RecentVaultEntry[] {
    try {
      const p = this.recentPath()
      if (!fs.existsSync(p)) return []
      return JSON.parse(fs.readFileSync(p, 'utf-8'))
    } catch { return [] }
  }

  addRecentVault(vaultPath: string): void {
    const entries = this.getRecentVaults()
    const filtered = entries.filter((e) => e.path !== vaultPath)
    filtered.unshift({ path: vaultPath, openedAt: new Date().toISOString() })
    const p = this.recentPath()
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, JSON.stringify(filtered.slice(0, RECENT_VAULTS_MAX), null, 2), 'utf-8')
  }

  private configPath(): string { return path.join(this.vaultRoot, KB_DIR, APP_CONFIG_FILENAME) }
  private recentPath(): string { return path.join(app.getPath('userData'), RECENT_VAULTS_FILENAME) }
}
