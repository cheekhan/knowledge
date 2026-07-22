/**
 * Markdown 预览组件 — 渲染 HTML + KaTeX + Mermaid
 */

import React, { useEffect, useRef } from 'react'
import { renderMarkdownWithKatex } from '../../markdown'
import katex from 'katex'

interface MarkdownPreviewProps {
  content: string
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // 渲染 Markdown → HTML
    const html = renderMarkdownWithKatex(content)
    containerRef.current.innerHTML = html

    // 渲染 KaTeX 公式
    const blocks = containerRef.current.querySelectorAll<HTMLElement>('.katex-block')
    blocks.forEach((el) => {
      const formula = el.dataset.formula
      if (formula) {
        try {
          katex.render(formula, el, { displayMode: true, throwOnError: false })
        } catch {
          el.textContent = formula
        }
      }
    })

    const inlines = containerRef.current.querySelectorAll<HTMLElement>('.katex-inline')
    inlines.forEach((el) => {
      const formula = el.dataset.formula
      if (formula) {
        try {
          katex.render(formula, el, { displayMode: false, throwOnError: false })
        } catch {
          el.textContent = formula
        }
      }
    })
  }, [content])

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        overflow: 'auto',
        padding: '24px 32px',
        fontSize: '15px',
        lineHeight: 1.75,
        color: 'var(--text-primary)',
        backgroundColor: 'var(--bg-primary)'
      }}
    />
  )
}

export default MarkdownPreview
