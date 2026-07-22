/**
 * 示例库服务 — 首次启动时从 resources/ 拷贝 default-vault
 */

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

const SOURCE_DIR = path.join(__dirname, '../../resources/default-vault')
const TARGET_NAME = 'default-vault'

/**
 * 获取示例库目标路径（用户数据目录下）
 */
function getTargetPath(): string {
  return path.join(app.getPath('userData'), TARGET_NAME)
}

/**
 * 确保示例库存在。首次启动时从 resources 拷贝。
 * @returns 示例库绝对路径
 */
export function ensureDefaultVault(): string {
  const target = getTargetPath()

  // 已存在则跳过
  if (fs.existsSync(target)) {
    return target
  }

  try {
    copyDir(SOURCE_DIR, target)
  } catch {
    // 拷贝失败也无妨，用户可手动打开库
  }

  return target
}

/** 递归拷贝目录 */
function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true })
  const entries = fs.readdirSync(src, { withFileTypes: true })

  for (const ent of entries) {
    const s = path.join(src, ent.name)
    const d = path.join(dest, ent.name)
    if (ent.isDirectory()) {
      copyDir(s, d)
    } else {
      fs.copyFileSync(s, d)
    }
  }
}
