/**
 * Markdown 渲染管线 — markdown-it + 插件链
 *
 * v2.0：不含任何引用解析插件（WikiLink / PDF ref）
 */

import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

/** 创建渲染实例 */
export function createRenderer(): MarkdownIt {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    breaks: true,
    highlight(str: string, lang: string): string {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return (
            '<pre class="hljs"><code>' +
            hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
            '</code></pre>'
          )
        } catch {
          // 高亮失败返回原文
        }
      }
      return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>'
    }
  })

  // GFM 表格 / 删除线 内置支持（启用）
  md.enable(['table', 'strikethrough'])

  return md
}

/** 单例渲染器 */
const md = createRenderer()

/**
 * 渲染 Markdown → HTML
 */
export function renderMarkdown(src: string): string {
  return md.render(src)
}

/**
 * 将 KaTeX 公式替换为占位，避免 markdown-it 误解析 $
 * 后续在 MarkdownPreview 中用 KaTeX 替换
 */
export function renderMarkdownWithKatex(src: string): string {
  const katexBlocks: string[] = []

  // 用不可见 Unicode 占位代替 HTML 注释，markdown-it 不会转义
  let processed = src.replace(/\$\$([\s\S]*?)\$\$/g, (_m, formula) => {
    katexBlocks.push(formula.trim())
    return `\n\u200B\u200BKATEXBLOCK${katexBlocks.length - 1}END\u200B\u200B\n`
  })

  processed = processed.replace(/\$([^\n$]+?)\$/g, (_m, formula) => {
    katexBlocks.push(formula.trim())
    return `\n\u200B\u200BKATEXINLINE${katexBlocks.length - 1}END\u200B\u200B\n`
  })

  let html = md.render(processed)

  html = html.replace(/\u200B\u200BKATEXBLOCK(\d+)END\u200B\u200B/g, (_m, i) => {
    const f = escapeHtmlAttr(katexBlocks[+i] || '')
    return `<span class="katex-block" data-formula="${f}"></span>`
  })

  html = html.replace(/\u200B\u200BKATEXINLINE(\d+)END\u200B\u200B/g, (_m, i) => {
    const f = escapeHtmlAttr(katexBlocks[+i] || '')
    return `<span class="katex-inline" data-formula="${f}"></span>`
  })

  return html
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
