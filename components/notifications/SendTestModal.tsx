// components/notifications/SendTestModal.tsx
'use client'

import { useState } from 'react'
import { Send, CheckCircle2, AlertCircle, Sparkles, Smartphone, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import type { MessageDraft } from '@/types/notification'
import type { DeliveryChannel } from '@/lib/notification-constants'
import { CHANNEL_LABEL } from './notification-ui'

interface Props {
  open: boolean
  onClose: () => void
  draft: MessageDraft
  channels: DeliveryChannel[]
  previewTitle: string
  previewBody: string
}

export default function SendTestModal({
  open,
  onClose,
  draft,
  channels,
  previewTitle,
  previewBody,
}: Props) {
  const [target, setTarget] = useState('')
  const [audience, setAudience] = useState<'users' | 'workers'>('users')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successResult, setSuccessResult] = useState<{
    campaignId: string
    recipient: { name: string | null; phone: string | null; email: string | null }
    pushDelivered?: number
    deliveryNote?: string
  } | null>(null)

  if (!open) return null

  async function handleSendTest() {
    if (!target.trim()) {
      setError('Please enter a phone number or user/worker ID.')
      return
    }

    setSending(true)
    setError(null)
    setSuccessResult(null)

    try {
      const res = await fetch('/api/admin/notifications/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: target.trim(),
          audience,
          message: draft,
          channels,
          label: previewTitle,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}: Failed to send test notification`)
      }

      setSuccessResult({
        campaignId: json.campaignId,
        recipient: json.recipient,
        pushDelivered: json.pushDelivered,
        deliveryNote: json.deliveryNote,
      })
    } catch (err: any) {
      setError(err.message || 'Something went wrong sending test notification')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1F6F5F]/10 text-[#1F6F5F]">
              <Send size={16} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Send Test Push Notification</h2>
              <p className="text-xs text-gray-500">Preview live on physical device via Firebase FCM</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={16} />
          </button>
        </div>

        {/* Message Summary Card */}
        <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50/70 p-3 text-xs">
          <div className="flex items-center justify-between font-semibold text-gray-700">
            <span>Payload Summary</span>
            <div className="flex gap-1">
              {channels.map((c) => (
                <Badge key={c} tone="neutral" className="text-[10px]">
                  {CHANNEL_LABEL[c]}
                </Badge>
              ))}
            </div>
          </div>
          <p className="mt-1.5 font-medium text-gray-900 truncate">
            {previewTitle || <span className="text-gray-400 italic">No title specified</span>}
          </p>
          <p className="mt-0.5 text-gray-600 line-clamp-2">
            {previewBody || <span className="text-gray-400 italic">No message body</span>}
          </p>
        </div>

        {/* Form Inputs */}
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">App Audience Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAudience('users')}
                className={cn(
                  'rounded-lg border p-2 text-xs font-medium transition',
                  audience === 'users'
                    ? 'border-[#1F6F5F] bg-[#1F6F5F]/10 text-[#1F6F5F]'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                )}
              >
                Customer App
              </button>
              <button
                type="button"
                onClick={() => setAudience('workers')}
                className={cn(
                  'rounded-lg border p-2 text-xs font-medium transition',
                  audience === 'workers'
                    ? 'border-[#1F6F5F] bg-[#1F6F5F]/10 text-[#1F6F5F]'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                )}
              >
                Worker App
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Test Recipient Phone or UUID
            </label>
            <Input
              value={target}
              placeholder="e.g. 03001234567 or user UUID"
              onChange={(e) => setTarget(e.target.value)}
              helperText="Enter the phone number or ID of the test account logged into the mobile app."
            />
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Banner */}
        {successResult && (
          <div
            className={cn(
              'mt-3 flex items-start gap-2 rounded-lg border p-3 text-xs',
              (successResult.pushDelivered ?? 0) > 0
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            )}
          >
            {(successResult.pushDelivered ?? 0) > 0 ? (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
            )}
            <div className="space-y-1">
              <p className="font-semibold">
                {(successResult.pushDelivered ?? 0) > 0
                  ? 'Push Delivered to Device! 🚀'
                  : 'Feed Item Created (Device Push Notice)'}
              </p>
              <p className="text-gray-700">
                Matched recipient: <strong>{successResult.recipient.name || 'Account'}</strong> (
                {successResult.recipient.phone || successResult.recipient.email})
              </p>
              {successResult.deliveryNote && (
                <p
                  className={cn(
                    'mt-1 rounded-md p-1.5 font-medium',
                    (successResult.pushDelivered ?? 0) > 0
                      ? 'bg-emerald-100/70 text-emerald-900'
                      : 'bg-amber-100/80 text-amber-950'
                  )}
                >
                  {successResult.deliveryNote}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-3">
          <Button variant="secondary" onClick={onClose} disabled={sending}>
            {successResult ? 'Done' : 'Cancel'}
          </Button>
          <Button
            onClick={handleSendTest}
            loading={sending}
            disabled={sending || !target.trim() || !previewTitle.trim()}
          >
            {sending ? 'Dispatching…' : 'Send Test Push'}
          </Button>
        </div>
      </div>
    </div>
  )
}
