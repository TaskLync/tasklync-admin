// components/disputes/DisputeResponses.tsx  (spec 7.2c: both sides + response deadline)
'use client'

import { useState } from 'react'
import { ExternalLink, FileText } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { stripAdminPrefix } from '@/lib/dispute-constants'
import type { DisputeDetail } from '@/types/dispute'
import { formatDateTime, responseState, useNow } from './dispute-ui'

const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif)($|\?)/i

function EvidenceThumb({ url, index }: { url: string; index: number }) {
  const [failed, setFailed] = useState(false)
  const looksLikeImage = IMAGE_RE.test(url) && !failed

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-50"
      title="Open in a new tab"
    >
      {looksLikeImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`Evidence ${index + 1}`}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex flex-col items-center gap-1 px-2 text-center text-[11px] text-gray-500">
          <FileText size={22} className="text-gray-400" />
          File {index + 1}
        </span>
      )}
      <span className="absolute right-1 top-1 hidden rounded bg-black/50 p-0.5 text-white group-hover:block">
        <ExternalLink size={12} />
      </span>
    </a>
  )
}

export default function DisputeResponses({ dispute }: { dispute: DisputeDetail }) {
  const now = useNow(30_000)
  const resp = responseState(dispute, now)

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Statements
      </h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Customer */}
        <div className="rounded-md border border-gray-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Customer{dispute.user.name ? ` · ${dispute.user.name}` : ''}
            </p>
            <span className="text-[11px] text-gray-400">{formatDateTime(dispute.createdAt)}</span>
          </div>
          {dispute.openedByAdmin && (
            <div className="mb-2">
              <Badge tone="info">Opened by an admin on the customer's behalf</Badge>
            </div>
          )}
          <p className="whitespace-pre-wrap break-words text-sm text-gray-800">
            {stripAdminPrefix(dispute.reason)}
          </p>

          <p className="mb-1.5 mt-4 text-xs font-medium text-gray-700">
            Photos / files from the customer ({dispute.evidenceUrls.length})
          </p>
          {dispute.evidenceUrls.length === 0 ? (
            <p className="text-xs text-gray-400">
              No files attached. Check the chat transcript below for photos shared during the job.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {dispute.evidenceUrls.map((url, i) => (
                <EvidenceThumb key={url + i} url={url} index={i} />
              ))}
            </div>
          )}
        </div>

        {/* Worker */}
        <div className="rounded-md border border-gray-200 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Worker{dispute.worker.name ? ` · ${dispute.worker.name}` : ''}
            </p>
            {resp.kind !== 'closed' && <Badge tone={resp.tone}>{resp.label}</Badge>}
          </div>

          {dispute.workerResponse ? (
            <p className="whitespace-pre-wrap break-words text-sm text-gray-800">
              {dispute.workerResponse}
            </p>
          ) : (
            <div className="rounded-md bg-gray-50 px-3 py-3 text-sm text-gray-500">
              {resp.kind === 'waiting' && (
                <>
                  No response yet. The worker can answer until{' '}
                  <strong className="text-gray-800">{formatDateTime(dispute.responseDueAt)}</strong>.
                </>
              )}
              {resp.kind === 'expired' && (
                <>
                  The worker did not respond within 24 hours (deadline was{' '}
                  {formatDateTime(dispute.responseDueAt)}). You can decide on the customer's account alone.
                </>
              )}
              {resp.kind === 'closed' && 'The worker never responded.'}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}