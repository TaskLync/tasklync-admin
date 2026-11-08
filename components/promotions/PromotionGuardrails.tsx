'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { usePermission } from '@/hooks/usePermission'
import { promotionActions, usePromotionSettings } from '@/hooks/usePromotions'
import { PROMOTION_SETTING_FIELDS, type PromotionSettingKey } from '@/lib/promotion-constants'

type Form = Record<PromotionSettingKey, string>

export default function PromotionGuardrails() {
  const { settings, isLoading, error, mutate } = usePromotionSettings()
  const canEdit = usePermission('settings:promotions')
  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!settings) return
    setForm(Object.fromEntries(PROMOTION_SETTING_FIELDS.map((f) => [f.key, String(settings[f.key])])) as Form)
  }, [settings])

  if (isLoading) return <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
  if (error || !form) return <p className="text-sm text-gray-500">Couldn't load the guardrails.</p>

  async function save() {
    if (!form) return
    setSaving(true)
    try {
      await promotionActions.saveSettings(
        Object.fromEntries(PROMOTION_SETTING_FIELDS.map((f) => [f.key, Number(form[f.key])]))
      )
      toast.success('Saved. Checkout uses the new limits within about a minute.')
      await mutate()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900">Offer guardrails</h2>
      <p className="mt-1 text-xs text-gray-500">
        Read by booking-service. Applies to new offers and to every checkout. Workers pay for their own offers, so keep these conservative at first.
        {!canEdit && ' You have view-only access.'}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {PROMOTION_SETTING_FIELDS.map((f) => (
          <label key={f.key} className="block text-sm">
            <span className="font-medium text-gray-700">{f.label}</span>
            <input
              type="number" step={f.step} min={f.min} max={f.max} disabled={!canEdit}
              value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
            />
            <span className="mt-0.5 block text-xs text-gray-400">{f.hint} ({f.min} to {f.max})</span>
          </label>
        ))}
      </div>
      {canEdit && (
        <div className="mt-5 flex justify-end">
          <button
            onClick={save} disabled={saving}
            className="cursor-pointer rounded-md bg-[#1F6F5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#195c4f] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save guardrails'}
          </button>
        </div>
      )}
    </div>
  )
}