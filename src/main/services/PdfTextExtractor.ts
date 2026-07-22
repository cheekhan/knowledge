import * as fs from 'fs'
import * as path from 'path'

export function extractText(vaultRoot: string, pdfRel: string): string {
  try {
    const absPath = path.join(vaultRoot, pdfRel)
    const buf = fs.readFileSync(absPath)
    const content = buf.toString('latin1')
    const text: string[] = []
    const streamRegex = /stream\s*\n([\s\S]*?)\nendstream/g
    let m
    while ((m = streamRegex.exec(content)) !== null) {
      const btRegex = /BT\s*\n([\s\S]*?)ET/g
      let b
      while ((b = btRegex.exec(m[1])) !== null) {
        const tjRegex = /\(([^)]*)\)\s*Tj/g
        let t
        while ((t = tjRegex.exec(b[1])) !== null) text.push(t[1])
      }
    }
    return text.join(' ').trim()
  } catch { return '' }
}
