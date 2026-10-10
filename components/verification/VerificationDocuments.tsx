// components/verification/VerificationDocuments.tsx  (spec 2.2b: zoomable CNIC / selfie / certificates)
'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, FileText, X, ZoomIn, ZoomOut } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDate } from '@/components/workers/worker-ui'
import {
  DOC_STATUS_LABEL,
  DOC_STATUS_VARIANT,
  DOC_TYPE_LABEL,
  isPdf,
} from './verification-ui'
import type { WorkerDocumentRow } from '@/types/worker'

interface ViewItem {
  key: string
  label: string
  url: string
}

// ---------- Viewer (lightbox with zoom) ----------

function DocumentViewer({ item, onClose }: { item: ViewItem; onClose: () => void }) {
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const btn =
    'flex h-8 w-8 items-center justify-center rounded-md text-white/80 transition-colors duration-150 hover:bg-white/10 hover:text-white'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/85">
      <div className="flex items-center justify-between px-4 py-3 text-sm text-white">
        <span className="font-medium">{item.label}</span>
        <div className="flex items-center gap-1">
          <button className={btn} onClick={() => setZoom((z) => Math.max(1, z - 0.5))} title="Zoom out">
            <ZoomOut size={16} />
          </button>
          <span className="w-12 text-center text-xs text-white/80">{Math.round(zoom * 100)}%</span>
          <button className={btn} onClick={() => setZoom((z) => Math.min(4, z + 0.5))} title="Zoom in">
            <ZoomIn size={16} />
          </button>
          <button
            className="h-8 rounded-md px-2 text-xs text-white/80 hover:bg-white/10 hover:text-white"
            onClick={() => setZoom(1)}
          >
            Reset
          </button>
          <a href={item.url} target="_blank" rel="noopener noreferrer" className={btn} title="Open in new tab">
            <ExternalLink size={16} />
          </a>
          <button className={btn} onClick={onClose} title="Close (Esc)">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt={item.label}
          className="mx-auto rounded-md"
          style={{ width: `${zoom * 100}%`, maxWidth: 'none' }}
        />
      </div>
    </div>
  )
}

// ---------- Card ----------

function DocumentCard({
  label,
  url,
  status,
  meta,
  note,
  onOpen,
}: {
  label: string
  url: string
  status?: string
  meta?: string
  note?: string | null
  onOpen: () => void
}) {
  const [failed, setFailed] = useState(false)
  const pdf = isPdf(url)

  return (
    <div className="overflow-hidden rounded-md border border-gray-200">
      <div className="flex h-56 items-center justify-center bg-gray-50">
        {pdf || failed ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 px-4 text-center text-xs text-gray-500 hover:text-gray-700"
          >
            <FileText size={28} className="text-gray-400" />
            {pdf ? 'PDF document: open in new tab' : "Couldn't load the image. Open in new tab"}
          </a>
        ) : (
          <button
            type="button"
            onClick={onOpen}
            className="h-full w-full cursor-zoom-in"
            title="Click to zoom"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={label}
              loading="lazy"
              onError={() => setFailed(true)}
              className="h-full w-full object-contain"
            />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1 border-t border-gray-100 p-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-gray-900">{label}</span>
          {status && (
            <StatusBadge
              status={status}
              variant={DOC_STATUS_VARIANT[status] ?? 'neutral'}
              label={DOC_STATUS_LABEL[status] ?? status}
            />
          )}
        </div>
        {meta && <p className="text-xs text-gray-400">{meta}</p>}
        {note && <p className="text-xs text-red-600">{note}</p>}
      </div>
    </div>
  )
}

// ---------- Section ----------

interface Props {
  documents: WorkerDocumentRow[]
  avatarUrl: string | null
}

export default function VerificationDocuments({ documents, avatarUrl }: Props) {
  const [viewing, setViewing] = useState<ViewItem | null>(null)

  // Number repeated types so two NATIONAL_ID uploads read "CNIC image 1 / 2"
  const typeTotals = documents.reduce<Record<string, number>>((acc, d) => {
    acc[d.type] = (acc[d.type] ?? 0) + 1
    return acc
  }, {})
  const typeSeen: Record<string, number> = {}

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Document review
      </h2>
      <p className="mb-3 text-xs text-gray-500">
        Compare the face on the CNIC with the profile photo. Click an image to zoom.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {avatarUrl && (
          <DocumentCard
            label="Profile photo (selfie)"
            url={avatarUrl}
            onOpen={() => setViewing({ key: 'avatar', label: 'Profile photo (selfie)', url: avatarUrl })}
          />
        )}

        {documents.map((d) => {
          typeSeen[d.type] = (typeSeen[d.type] ?? 0) + 1
          const base = DOC_TYPE_LABEL[d.type] ?? d.type
          const label = typeTotals[d.type] > 1 ? `${base} (${typeSeen[d.type]})` : base
          return (
            <DocumentCard
              key={d.id}
              label={label}
              url={d.fileUrl}
              status={d.status}
              meta={`Uploaded ${formatDate(d.createdAt)}${d.reviewedAt ? ` · reviewed ${formatDate(d.reviewedAt)}` : ''}`}
              note={d.rejectionNote}
              onOpen={() => setViewing({ key: d.id, label, url: d.fileUrl })}
            />
          )
        })}
      </div>

      {documents.length === 0 && !avatarUrl && (
        <p className="text-sm text-gray-500">No documents uploaded.</p>
      )}

      {viewing && <DocumentViewer item={viewing} onClose={() => setViewing(null)} />}
    </Card>
  )
}