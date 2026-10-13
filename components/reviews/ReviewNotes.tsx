// components/reviews/ReviewNotes.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { usePermission } from '@/hooks/usePermission'
import { reviewActions, useReviewNotes } from '@/hooks/useReviews'
import { formatDateTime } from './review-ui'

export default function ReviewNotes({ reviewId }: { reviewId: string }) {
  const { notes, isLoading, error, mutate } = useReviewNotes(reviewId)
  const canNote = usePermission('reviews:note')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  async function add() {
    if (!text.trim()) return
    setSaving(true)
    try {
      await reviewActions.addNote(reviewId, text.trim())
      setText('')
      toast.success('Note added')
      mutate()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-4">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Internal notes
      </h2>
      <p className="mb-3 text-xs text-gray-400">
        Only admins can see these. Never shown to the customer or worker.
      </p>

      {canNote && (
        <div className="mb-4">
          <textarea
            className="h-20 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F6F5F]"
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Called the worker, they say the job was never done. Checking the GPS trail."
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" loading={saving} disabled={!text.trim()} onClick={add}>
              Add note
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-gray-500">
          Couldn't load notes.{' '}
          <button onClick={() => mutate()} className="text-[#1F6F5F] hover:underline">
            Retry
          </button>
        </p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-gray-500">No notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-md bg-gray-50 px-3 py-2">
              <p className="whitespace-pre-wrap break-words text-sm text-gray-800">{n.note}</p>
              <p className="mt-1 text-[11px] text-gray-400">
                {n.adminEmail} · {formatDateTime(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}