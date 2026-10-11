// components/notifications/ComposeTab.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, Send } from 'lucide-react'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/cn'
import { usePermission } from '@/hooks/usePermission'
import { notificationActions, useAudienceEstimate } from '@/hooks/useNotifications'
import {
  checkValues,
  defaultValues,
  getTemplate,
  previewTemplate,
  templateKey,
  type TemplateLanguage,
} from '@/lib/notification-catalog'
import SendTestModal from './SendTestModal'
import {
  BROAD_SEGMENTS,
  DEEP_LINK_RE,
  DELIVERY_CHANNELS,
  LIMITS,
  QUIET_HOURS,
  isQuietHours,
  type BroadcastCategory,
  type DeliveryChannel,
} from '@/lib/notification-constants'
import type { AudienceSelection, LaunchRequest, MessageDraft } from '@/types/notification'
import AudiencePicker from './AudiencePicker'
import MessageEditor from './MessageEditor'
import PhonePreview from './PhonePreview'
import { CATEGORY_LABEL, CHANNEL_LABEL, audienceLabel, prettify } from './notification-ui'

export interface ComposeSeed {
  templateId?: string
  language?: TemplateLanguage
}

function initialDraft(seed: ComposeSeed | null): MessageDraft {
  const t = seed?.templateId ? getTemplate(seed.templateId) : undefined
  if (t) {
    return { mode: 'template', templateId: t.id, language: seed?.language ?? 'en', values: defaultValues(t) }
  }
  return { mode: 'custom', title: '', body: '', deepLink: '' }
}

function previewOf(draft: MessageDraft): { title: string; body: string } {
  if (draft.mode === 'custom') return { title: draft.title.trim(), body: draft.body.trim() }
  const t = getTemplate(draft.templateId)
  return t ? previewTemplate(t, draft.language, draft.values) : { title: '', body: '' }
}

function composeProblems(args: {
  audience: AudienceSelection | null
  draft: MessageDraft
  channels: DeliveryChannel[]
  recipientCount: number | null
}): string[] {
  const { audience, draft, channels, recipientCount } = args
  const problems: string[] = []

  if (!audience) problems.push('Choose who should receive this.')
  else if (recipientCount === 0) problems.push('Nobody matches this audience.')

  if (channels.length === 0) problems.push('Choose at least one channel.')

  if (draft.mode === 'template') {
    const t = getTemplate(draft.templateId)
    if (!t) problems.push('Choose a template.')
    else problems.push(...checkValues(t, draft.values).errors)
  } else {
    const bodyMax = channels.includes('sms') ? LIMITS.smsBody : LIMITS.pushBody
    if (!draft.title.trim()) problems.push('Write a title.')
    if (draft.title.length > LIMITS.title) problems.push(`Title is over ${LIMITS.title} characters.`)
    if (!draft.body.trim()) problems.push('Write a message.')
    if (draft.body.length > bodyMax) problems.push(`Message is over ${bodyMax} characters.`)
    if (/["\\]/.test(draft.title + draft.body)) problems.push("Remove double quotes and backslashes (use ').")
    if (draft.deepLink.trim() && !DEEP_LINK_RE.test(draft.deepLink.trim())) {
      problems.push('Deep link must look like tasklync://home.')
    }
  }
  return problems
}

function SectionTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
      {n}. {children}
    </h2>
  )
}

export default function ComposeTab({ seed }: { seed: ComposeSeed | null }) {
  const router = useRouter()

  // Hydration fix: anything that can differ between server and client
  // (permissions from client state, current time) waits until after mount.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const hasBroadcastPerm = usePermission('notifications:broadcast-all')
  const canBroadcastAll = mounted && hasBroadcastPerm

  const [label, setLabel] = useState('')
  const [audience, setAudience] = useState<AudienceSelection | null>(null)
  const [draft, setDraft] = useState<MessageDraft>(() => initialDraft(seed))
  const [customCategory, setCustomCategory] = useState<BroadcastCategory>('marketing')
  const [channels, setChannels] = useState<DeliveryChannel[]>(['push'])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [ackQuiet, setAckQuiet] = useState(false)

  const template = draft.mode === 'template' ? getTemplate(draft.templateId) : undefined
  const category: BroadcastCategory = template?.category ?? customCategory

  const { estimate, loading: estimating, error: estimateError } = useAudienceEstimate(audience, category)
  const preview = previewOf(draft)
  const quiet = mounted && isQuietHours()
  const broad = audience ? BROAD_SEGMENTS.includes(audience.segmentType) : false

  const problems = composeProblems({
    audience,
    draft,
    channels,
    recipientCount: estimate ? estimate.segmentCount : null,
  })
  const defaultLabel = `${template?.name ?? (preview.title || 'Custom message')} · ${new Date().toISOString().slice(0, 10)}`
  const effectiveLabel = (label.trim() || defaultLabel).slice(0, LIMITS.label)
  const canSend = problems.length === 0 && !!estimate && !estimating

  function toggleChannel(c: DeliveryChannel) {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  const reachLine = estimate
    ? `${estimate.segmentCount.toLocaleString('en-PK')} recipients · about ${
        channels.includes('push') && estimate.pushReach !== null
          ? `${estimate.pushReach.toLocaleString('en-PK')} will get a push`
          : 'push reach unknown'
      }`
    : ''

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* ---------- Left: the form ---------- */}
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card className="p-4">
          <SectionTitle n={1}>Audience</SectionTitle>
          <AudiencePicker value={audience} onChange={setAudience} canBroadcastAll={canBroadcastAll} />
        </Card>

        <Card className="p-4">
          <SectionTitle n={2}>Message</SectionTitle>
          <MessageEditor
            draft={draft}
            onChange={setDraft}
            customCategory={customCategory}
            onCustomCategoryChange={setCustomCategory}
            channels={channels}
          />
        </Card>

        <Card className="p-4">
          <SectionTitle n={3}>Channels</SectionTitle>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DELIVERY_CHANNELS.map((c) => (
              <label
                key={c}
                className={cn(
                  'flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm',
                  channels.includes(c) ? 'border-[#1F6F5F] bg-[#1F6F5F]/5' : 'border-gray-200'
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 accent-[#1F6F5F]"
                  checked={channels.includes(c)}
                  onChange={() => toggleChannel(c)}
                />
                <span>
                  <span className="font-medium text-gray-900">{CHANNEL_LABEL[c]}</span>
                  <span className="block text-xs text-gray-400">
                    {c === 'push'
                      ? 'Free. Reaches people with the app and push turned on.'
                      : 'Costs money per message. Only for people who opted in to SMS.'}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Everyone in the audience also gets the message in their in-app notification list, whatever they opted out of.
          </p>
        </Card>

        <Card className="p-4">
          <SectionTitle n={4}>Campaign name (optional)</SectionTitle>
          <Input
            value={label}
            maxLength={LIMITS.label}
            placeholder={defaultLabel}
            onChange={(e) => setLabel(e.target.value)}
            helperText="Internal label for the History tab. Recipients never see it."
          />
        </Card>
      </div>

      {/* ---------- Right: preview + reach + send ---------- */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Preview</h2>
          <PhonePreview
            title={preview.title}
            body={preview.body}
            sms={channels.includes('sms')}
            imageUrl={draft.imageUrl}
            deepLink={draft.mode === 'custom' ? draft.deepLink : template?.deepLink}
            templateKey={
              template && draft.mode === 'template'
                ? templateKey(template.id, draft.language)
                : 'admin_custom_message'
            }
          />
        </Card>

        <Card className="flex flex-col gap-3 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Who will get it</h2>

          {!audience && <p className="text-sm text-gray-400">Choose an audience to see the reach.</p>}
          {audience && estimating && <div className="h-16 animate-pulse rounded bg-gray-100" />}
          {audience && estimateError && <p className="text-sm text-red-600">{estimateError}</p>}

          {audience && estimate && !estimating && (
            <dl className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Audience</dt>
                <dd className="font-medium text-gray-900">
                  {audience.segmentType === 'custom_ids'
                    ? audienceLabel('custom_ids', audience.audience === 'users' ? { user_ids: audience.ids } : { worker_ids: audience.ids })
                    : audience.segmentType === 'category_city'
                      ? `${prettify(audience.categoryId)} · ${audience.city}`
                      : audienceLabel(audience.segmentType, {})}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">In-app notification</dt>
                <dd className="font-medium text-gray-900">{estimate.segmentCount.toLocaleString('en-PK')}</dd>
              </div>
              {channels.includes('push') && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Push (estimated)</dt>
                  <dd className="font-medium text-gray-900">
                    {estimate.pushReach === null ? '—' : estimate.pushReach.toLocaleString('en-PK')}
                  </dd>
                </div>
              )}
              {channels.includes('sms') && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">SMS (estimated)</dt>
                  <dd className="font-medium text-gray-900">
                    {estimate.smsReach === null ? '—' : estimate.smsReach.toLocaleString('en-PK')}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">Type</dt>
                <dd className="font-medium text-gray-900">{CATEGORY_LABEL[category]}</dd>
              </div>
            </dl>
          )}

          {estimate && category === 'marketing' && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Marketing is opt-in. Only people who switched marketing notifications on will get a push or SMS. Everyone else
              sees it in the app only.
            </p>
          )}
          {estimate && estimate.sample.length > 0 && audience?.segmentType !== 'custom_ids' && (
            <p className="text-[11px] text-gray-400">
              e.g. {estimate.sample.map((s) => s.name ?? 'Unnamed').join(', ')}
            </p>
          )}
        </Card>

        {quiet && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <p>
              Quiet hours are on ({QUIET_HOURS.startHour}:00 to 0{QUIET_HOURS.endHour}:00 PKT). Push and SMS from broadcasts are
              <strong> dropped, not delayed</strong>, in this window. People would only see it in the app. Better to send after
              08:00.
            </p>
          </div>
        )}

        {problems.length > 0 && audience && (
          <ul className="list-disc rounded-lg bg-gray-50 py-2 pl-7 pr-3 text-xs text-gray-600">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            disabled={!preview.title.trim()}
            onClick={() => setTestModalOpen(true)}
            className="w-full"
          >
            <Send size={13} className="mr-1.5" /> Send test to my device
          </Button>
          <Button
            disabled={!canSend}
            onClick={() => {
              setAckQuiet(false)
              setConfirmOpen(true)
            }}
            className="w-full"
          >
            Review &amp; send
          </Button>
        </div>
      </div>

      {/* ---------- Confirm ---------- */}
      <ConfirmDialog
        open={confirmOpen}
        title="Send this notification?"
        description="It goes out right away and can't be recalled."
        confirmLabel="Send now"
        destructive={false}
        requireTypedConfirmation={broad ? 'SEND' : undefined}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => {
          if (quiet && !ackQuiet) throw new Error('Tick the box to confirm you understand quiet hours.')
          if (!audience) throw new Error('Choose an audience')
          const request: LaunchRequest = {
            title: effectiveLabel,
            message: draft,
            channels,
            category,
            audience,
            acknowledgeQuietHours: ackQuiet,
          }
          const res = await notificationActions.launch(request)
          toast.success('Broadcast queued')
          router.push(`/notifications/${res.campaignId}`)
        }}
      >
        <div className="flex flex-col gap-3 text-sm">
          <div className="rounded-md bg-gray-50 px-3 py-2">
            <p className="font-semibold text-gray-900">{preview.title}</p>
            <p className="text-gray-600">{preview.body}</p>
          </div>
          <p className="text-gray-700">
            {reachLine}. Channels: {channels.map((c) => CHANNEL_LABEL[c]).join(' + ')}. {CATEGORY_LABEL[category]}.
          </p>
          {quiet && (
            <label className="flex cursor-pointer items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[#1F6F5F]"
                checked={ackQuiet}
                onChange={(e) => setAckQuiet(e.target.checked)}
              />
              <span>I understand push and SMS are dropped during quiet hours, so most people will only see this in the app.</span>
            </label>
          )}
        </div>
      </ConfirmDialog>

      {/* ---------- Send Test Push Modal ---------- */}
      <SendTestModal
        open={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        draft={draft}
        channels={channels}
        previewTitle={preview.title}
        previewBody={preview.body}
      />
    </div>
  )
}