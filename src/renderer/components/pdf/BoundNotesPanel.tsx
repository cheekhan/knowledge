import React from 'react'
import { usePdfStore } from '../../stores/pdf.store'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { bindingService } from '../../services/binding.service'
import type { BoundNoteInfo } from '../../../shared/types'

interface Props { pdfPath: string }

const BoundNotesPanel: React.FC<Props> = ({ pdfPath }) => {
  const boundNotes = usePdfStore((s) => s.boundNotes)
  const setBoundNotes = usePdfStore((s) => s.setBoundNotes)
  const openSplit = useWorkspaceStore((s) => s.openSplit)

  const handleOpen = (p: string) => openSplit(pdfPath, p)
  const handleUnbind = async (p: string) => {
    await bindingService.unbind(pdfPath, p)
    setBoundNotes(boundNotes.filter((b) => b.notePath !== p))
  }
  const handleClean = async (p: string) => {
    await bindingService.unbind(pdfPath, p)
    setBoundNotes(boundNotes.filter((b) => b.notePath !== p))
  }

  return (
    <div>
      {boundNotes.map((bn: BoundNoteInfo) => (
        <div key={bn.notePath} onClick={() => !bn.missing && handleOpen(bn.notePath)} style={{ padding: '6px 12px', cursor: bn.missing ? 'default' : 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, opacity: bn.missing ? 0.4 : 1, color: bn.missing ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bn.missing ? '⚠' : '📝'} {bn.title}</span>
          <button onClick={(e) => { e.stopPropagation(); if (bn.missing) handleClean(bn.notePath); else handleUnbind(bn.notePath) }} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-tertiary)', padding: '2px 4px' }}>{bn.missing ? '×' : '✕'}</button>
        </div>
      ))}
    </div>
  )
}

export default BoundNotesPanel
