/**
 * Markdown 渲染管线测试
 */

import { describe, it, expect } from 'vitest'
import { renderMarkdown, renderMarkdownWithKatex, createRenderer } from '../index'

describe('renderMarkdown', () => {
  it('渲染标题', () => {
    const html = renderMarkdown('# Hello')
    expect(html).toContain('<h1>Hello</h1>')
  })

  it('渲染 GFM 表格', () => {
    const html = renderMarkdown('|a|b|\n|-|-|\n|1|2|')
    expect(html).toContain('<table>')
    expect(html).toContain('<td>1</td>')
  })

  it('渲染代码高亮', () => {
    const html = renderMarkdown('```js\nconst x = 1;\n```')
    expect(html).toContain('hljs')
    expect(html).toContain('<code>')
  })

  it('渲染行内代码', () => {
    const html = renderMarkdown('use `code` here')
    expect(html).toContain('<code>code</code>')
  })

  it('粗体与斜体', () => {
    const html = renderMarkdown('**bold** and *italic*')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
  })

  it('链接渲染', () => {
    const html = renderMarkdown('[Google](https://google.com)')
    expect(html).toContain('href="https://google.com"')
    expect(html).toContain('>Google<')
  })

  it('无序列表', () => {
    const html = renderMarkdown('- item1\n- item2')
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>item1</li>')
  })

  it('不含 wiki 双链解析', () => {
    const html = renderMarkdown('[[链接]]')
    // v2.0 不解析 wiki 链接，按原文渲染
    expect(html).not.toContain('data-ref')
  })
})

describe('renderMarkdownWithKatex', () => {
  it('块级公式 → katex-block span', () => {
    const html = renderMarkdownWithKatex('$$E=mc^2$$')
    expect(html).toContain('katex-block')
    expect(html).toContain('data-formula="E=mc^2"')
  })

  it('行内公式 → katex-inline span', () => {
    const html = renderMarkdownWithKatex('公式 $x^2$ 行内')
    expect(html).toContain('katex-inline')
    expect(html).toContain('data-formula="x^2"')
  })
})

describe('createRenderer', () => {
  it('创建渲染器可复用的实例', () => {
    const md = createRenderer()
    const h1 = md.render('# A')
    const h2 = md.render('# B')
    expect(h1).toContain('<h1>A</h1>')
    expect(h2).toContain('<h1>B</h1>')
  })
})
