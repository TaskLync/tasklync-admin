// components/notifications/AudiencePicker.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { useWorkerFilterOptions } from '@/hooks/useWorkers'
import { notificationActions } from '@/hooks/useNotifications'
import { LIMITS } from '@/lib/notification-constants'
import type { AudienceSelection, ResolveResult } from '@/types/notification'
import { Field, KNOWN_CITIES, SELECT_CLASS, Segmented } from './notification-ui'

type Mode = 'all_users' | 'all_workers' | 'category_city' | 'custom_ids'

const OPTIONS: { mode: Mode; title: string; hint: string; broad?: boolean }[] = [
  { mode: 'all_users', title: 'All users', hint: 'Every customer account.', broad: true },
  { mode: 'all_workers', title: 'All workers', hint: 'Every worker account.', broad: true },
  { mode: 'category_city', title: 'Workers by service & city', hint: 'Verified workers in one category and city.' },
  { mode: 'custom_ids', title: 'Specific people', hint: 'Paste phone numbers, emails or IDs. Good for tests.' },
]

interface Props {
  value: AudienceSelection | null
  onChange: (value: AudienceSelection | null) => void
  /** SUPER_ADMIN only. */
  canBroadcastAll: boolean
}

export default function AudiencePicker({ value, onChange, canBroadcastAll }: Props) {
  const { categories } = useWorkerFilterOptions()
  const [mode, setMode] = useState<Mode | null>(value?.segmentType ?? null)
  const [categoryId, setCategoryId] = useState('')
  const [city, setCity] = useState('')
  const [who, setWho] = useState<'users' | 'workers'>('users')
  const [text, setText] = useState('')
  const [lookup, setLookup] = useState<ResolveResult | null>(null)
  const [looking, setLooking] = useState(false)

  function pick(m: Mode) {
    setMode(m)
    setLookup(null)
    if (m === 'all_users' || m === 'all_workers') onChange({ segmentType: m })
    else if (m === 'category_city')
      onChange(categoryId && city ? { segmentType: 'category_city', categoryId, city } : null)
    else onChange(null)
  }

  function setCategoryCity(nextCategory: string, nextCity: string) {
    setCategoryId(nextCategory)
    setCity(nextCity)
    onChange(
      nextCategory && nextCity ? { segmentType: 'category_city', categoryId: nextCategory, city: nextCity } : null
    )
  }

  function identifiers(): string[] {
    return [...new Set(text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean))]
  }

  function invalidateLookup() {
    setLookup(null)
    onChange(null)
  }

  async function runLookup() {
    const list = identifiers()
    if (list.length === 0) return toast.error('Paste at least one phone, email or ID')
    if (list.length > LIMITS.specificPeople) {
      return toast.error(`At most ${LIMITS.specificPeople} people at a time`)
    }
    setLooking(true)
    try {
      const res = await notificationActions.resolveRecipients(who, list)
      setLookup(res)
      onChange(
        res.matched.length
          ? { segmentType: 'custom_ids', audience: who, ids: res.matched.map((m) => m.id) }
          : null
      )
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLooking(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {OPTIONS.map((o) => {
          const disabled = Boolean(o.broad) && !canBroadcastAll
          return (
            <label
              key={o.mode}
              className={cn(
                'flex items-start gap-2 rounded-md border p-3 text-sm',
                disabled ? 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-60' : 'cursor-pointer',
                !disabled && mode === o.mode ? 'border-[#1F6F5F] bg-[#1F6F5F]/5' : 'border-gray-200'
              )}
            >
              <input
                type="radio"
                name="audience"
                className="mt-0.5 accent-[#1F6F5F]"
                disabled={disabled}
                checked={mode === o.mode}
                onChange={() => pick(o.mode)}
              />
              <span>
                <span className="font-medium text-gray-900">{o.title}</span>
                <span className="block text-xs text-gray-400">
                  {disabled ? 'Super Admin only.' : o.hint}
                </span>
              </span>
            </label>
          )
        })}
      </div>

      {mode === 'category_city' && (
        <div className="flex flex-wrap gap-3">
          <Field label="Service">
            <select
              className={SELECT_CLASS}
              value={categoryId}
              onChange={(e) => setCategoryCity(e.target.value, city)}
            >
              <option value="">Choose a service</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="City">
            <select
              className={SELECT_CLASS}
              value={city}
              onChange={(e) => setCategoryCity(categoryId, e.target.value)}
            >
              <option value="">Choose a city</option>
              {KNOWN_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {mode === 'custom_ids' && (
        <div className="flex flex-col gap-3">
          <Segmented
            value={who}
            options={[
              { value: 'users', label: 'Users' },
              { value: 'workers', label: 'Workers' },
            ]}
            onChange={(v) => {
              setWho(v)
              invalidateLookup()
            }}
          />
          <textarea
            className="h-28 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#1F6F5F]"
            placeholder={'0300 1234567\n+92 321 7654321\nname@example.com'}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              if (lookup) invalidateLookup()
            }}
          />
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" loading={looking} onClick={runLookup}>
              Look up people
            </Button>
            <span className="text-xs text-gray-400">
              {identifiers().length} / {LIMITS.specificPeople}. One per line or comma-separated.
            </span>
          </div>

          {lookup && (
            <div className="rounded-md bg-gray-50 px-3 py-2 text-sm">
              <p className="font-medium text-gray-800">
                {lookup.matched.length} found
                {lookup.notFound.length > 0 && (
                  <span className="font-normal text-amber-700"> · {lookup.notFound.length} not found</span>
                )}
              </p>
              {lookup.matched.length > 0 && (
                <ul className="mt-1 max-h-32 overflow-y-auto text-xs text-gray-600">
                  {lookup.matched.slice(0, 20).map((m) => (
                    <li key={m.id}>
                      {m.name ?? 'Unnamed'} <span className="font-mono text-gray-400">{m.phone ?? m.email ?? ''}</span>
                    </li>
                  ))}
                  {lookup.matched.length > 20 && <li className="text-gray-400">…and {lookup.matched.length - 20} more</li>}
                </ul>
              )}
              {lookup.notFound.length > 0 && (
                <p className="mt-1 break-words text-xs text-amber-700">
                  Not found: {lookup.notFound.slice(0, 10).join(', ')}
                  {lookup.notFound.length > 10 ? '…' : ''}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}