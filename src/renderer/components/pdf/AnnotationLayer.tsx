import React from 'react'
import type { Annotation } from '../../../shared/types'
import { normalizedToScreen } from '../../lib/coord'

interface Props {
  annotations: Annotation[]
  pageWidth: number; pageHeight: number
  selectedId: string | null; onSelect: (id: string | null) => void
}

const AnnotationLayer: React.FC<Props> = ({ annotations, pageWidth, pageHeight, selectedId, onSelect }) => {
  if (annotations.length === 0) return null
  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, width: pageWidth, height: pageHeight, pointerEvents: 'none' }}>
      {annotations.map((a) => {
        const s = normalizedToScreen(a.rect, pageWidth, pageHeight)
        const sel = a.id === selectedId
        return (
          <g key={a.id}>
            <rect x={s.x} y={s.y} width={s.width} height={s.height} fill={a.color} fillOpacity={sel ? 0.35 : 0.15} stroke={a.color} strokeWidth={sel ? 2 : 1} style={{ pointerEvents: 'auto', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onSelect(sel ? null : a.id) }} />
            {sel && a.comment && (
              <foreignObject x={s.x} y={s.y + s.height + 4} width={Math.max(s.width, 180)} height={40}>
                <div style={{ fontSize: 11, padding: '4px 8px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 4, color: 'var(--text-primary)' }}>{a.comment}</div>
              </foreignObject>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export default AnnotationLayer
