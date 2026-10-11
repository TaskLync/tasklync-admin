// components/notifications/MessageEditor.tsx
'use client'

import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/cn'
import {
  CATALOG,
  LANGUAGE_LABEL,
  defaultValues,
  getTemplate,
  type TemplateKind,
  type TemplateLanguage,
} from '@/lib/notification-catalog'
import {
  BROADCAST_CATEGORIES,
  LIMITS,
  type BroadcastCategory,
  type DeliveryChannel,
} from '@/lib/notification-constants'
import { Badge } from '@/components/ui/Badge'
import type { MessageDraft } from '@/types/notification'
import {
  CATEGORY_HINT,
  CATEGORY_LABEL,
  Counter,
  KIND_LABEL,
  SELECT_CLASS,
  Segmented,
} from './notification-ui'

const TEXTAREA =
  'h-24 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F6F5F]'
const KIND_ORDER: TemplateKind[] = ['operational', 'promo', 'greeting', 'seasonal']

interface Props {
  draft: MessageDraft
  onChange: (draft: MessageDraft) => void
  customCategory: BroadcastCategory
  onCustomCategoryChange: (c: BroadcastCategory) => void
  channels: DeliveryChannel[]
}

export default function MessageEditor({
  draft,
  onChange,
  customCategory,
  onCustomCategoryChange,
  channels,
}: Props) {
  const template = draft.mode === 'template' ? getTemplate(draft.templateId) : undefined
  const bodyMax = channels.includes('sms') ? LIMITS.smsBody : LIMITS.pushBody

  function switchMode(mode: 'template' | 'custom') {
    if (mode === draft.mode) return
    if (mode === 'custom') {
      onChange({ mode: 'custom', title: '', body: '', deepLink: '' })
    } else {
      const t = CATALOG[0]
      onChange({ mode: 'template', templateId: t.id, language: 'en', values: defaultValues(t) })
    }
  }

  function pickTemplate(id: string) {
    const t = getTemplate(id)
    if (!t) return
    onChange({
      mode: 'template',
      templateId: id,
      language: draft.mode === 'template' ? draft.language : 'en',
      values: defaultValues(t),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        value={draft.mode}
        options={[
          { value: 'template', label: 'Ready-made template' },
          { value: 'custom', label: 'Write my own' },
        ]}
        onChange={switchMode}
      />

      {draft.mode === 'template' && template && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[260px] flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-700">Template</label>
              <select
                className={cn(SELECT_CLASS, 'w-full')}
                value={template.id}
                onChange={(e) => pickTemplate(e.target.value)}
              >
                {KIND_ORDER.map((kind) => (
                  <optgroup key={kind} label={KIND_LABEL[kind]}>
                    {CATALOG.filter((t) => t.kind === kind).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Language</label>
              <Segmented<TemplateLanguage>
                value={draft.language}
                options={(['en', 'ur'] as const).map((l) => ({ value: l, label: LANGUAGE_LABEL[l] }))}
                onChange={(language) => onChange({ ...draft, language })}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>{template.description}</span>
            <Badge tone={template.category === 'platform' ? 'info' : 'warning'}>
              {CATEGORY_LABEL[template.category]}
            </Badge>
            {template.audience !== 'anyone' && (
              <Badge tone="neutral">Meant for {template.audience}</Badge>
            )}
            {template.greetingOnly && <Badge tone="danger">Greeting only: no discounts</Badge>}
          </div>

          {template.variables.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {template.variables.map((v) => (
                <Input
                  key={v.key}
                  label={v.label}
                  type={v.type === 'text' ? 'text' : 'number'}
                  min={v.min}
                  max={v.max}
                  placeholder={v.placeholder}
                  value={draft.values[v.key] ?? ''}
                  onChange={(e) =>
                    onChange({ ...draft, values: { ...draft.values, [v.key]: e.target.value } })
                  }
                  helperText={
                    v.type !== 'text' && v.min !== undefined && v.max !== undefined
                      ? `${v.min} to ${v.max}`
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </>
      )}

      {draft.mode === 'custom' && (
        <div className="flex flex-col gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-gray-700">Title</label>
              <Counter value={draft.title.length} max={LIMITS.title} />
            </div>
            <Input
              value={draft.title}
              placeholder="Short and clear"
              onChange={(e) => onChange({ ...draft, title: e.target.value })}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-gray-700">Message</label>
              <Counter value={draft.body.length} max={bodyMax} />
            </div>
            <textarea
              className={TEXTAREA}
              value={draft.body}
              placeholder="What do you want people to know?"
              onChange={(e) => onChange({ ...draft, body: e.target.value })}
            />
            <p className="mt-1 text-xs text-gray-400">
              Plain text only. Double quotes and backslashes are not allowed. Use a single quote (&apos;).
              Same message for everyone, so no names.
            </p>
          </div>
          <Input
            label="Opens in the app (optional)"
            placeholder="tasklync://home"
            value={draft.deepLink}
            onChange={(e) => onChange({ ...draft, deepLink: e.target.value })}
            helperText="Leave empty for the home screen."
          />

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">What kind of message is this?</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {BROADCAST_CATEGORIES.map((c) => (
                <label
                  key={c}
                  className={cn(
                    'flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm',
                    customCategory === c ? 'border-[#1F6F5F] bg-[#1F6F5F]/5' : 'border-gray-200'
                  )}
                >
                  <input
                    type="radio"
                    name="custom-category"
                    className="mt-0.5 accent-[#1F6F5F]"
                    checked={customCategory === c}
                    onChange={() => onCustomCategoryChange(c)}
                  />
                  <span>
                    <span className="font-medium text-gray-900">{CATEGORY_LABEL[c]}</span>
                    <span className="block text-xs text-gray-400">{CATEGORY_HINT[c]}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Choose honestly. Promotions sent as operational announcements ignore people&apos;s marketing opt-out.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}