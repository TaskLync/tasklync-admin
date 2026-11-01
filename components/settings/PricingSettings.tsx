'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { usePricingConfig, pricingConfigActions } from '@/hooks/useCategories'

type Form = {
  customerFeePercent: string
  workerCommissionPercent: string
  demandThreshold: string
  demandMultiplier: string
  urgencySameDayMultiplier: string
  urgencyWithin2hMultiplier: string
  offPeakMultiplier: string
}

const FIELDS: { key: keyof Form; label: string; hint: string }[] = [
  { key: 'customerFeePercent', label: 'Customer fee (%)', hint: 'Added on top of the job price. Paid by the customer.' },
  { key: 'workerCommissionPercent', label: 'Worker commission (%)', hint: 'Deducted from the worker payout.' },
  { key: 'demandThreshold', label: 'Demand threshold (workers)', hint: 'Surge applies when fewer workers than this are nearby.' },
  { key: 'demandMultiplier', label: 'Demand multiplier', hint: 'e.g. 1.2 = +20%' },
  { key: 'urgencySameDayMultiplier', label: 'Urgent, same day multiplier', hint: 'e.g. 1.3' },
  { key: 'urgencyWithin2hMultiplier', label: 'Urgent, within 2 hours multiplier', hint: 'e.g. 1.5' },
  { key: 'offPeakMultiplier', label: 'Off-peak multiplier', hint: 'Stored for later. Not applied to prices yet.' },
]

export default function PricingSettings() {
  const { config, isLoading, mutate } = usePricingConfig()
  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!config) return
    setForm({
      customerFeePercent: String(config.customerFeePercent),
      workerCommissionPercent: String(config.workerCommissionPercent),
      demandThreshold: String(config.demandThreshold),
      demandMultiplier: String(config.demandMultiplier),
      urgencySameDayMultiplier: String(config.urgencySameDayMultiplier),
      urgencyWithin2hMultiplier: String(config.urgencyWithin2hMultiplier),
      offPeakMultiplier: String(config.offPeakMultiplier),
    })
  }, [config])

  if (isLoading || !form) return <div className="h-40 animate-pulse rounded-lg bg-gray-100" />

  async function save() {
    if (!form) return
    setSaving(true)
    try {
      const customer = Number(form.customerFeePercent)
      const worker = Number(form.workerCommissionPercent)
      await pricingConfigActions.update({
        customerFeePercent: customer,
        workerCommissionPercent: worker,
        platformFeePercent: customer + worker,
        demandThreshold: Number(form.demandThreshold),
        demandMultiplier: Number(form.demandMultiplier),
        urgencySameDayMultiplier: Number(form.urgencySameDayMultiplier),
        urgencyWithin2hMultiplier: Number(form.urgencyWithin2hMultiplier),
        offPeakMultiplier: Number(form.offPeakMultiplier),
      })
      toast.success('Saved. Bookings use the new prices within about a minute.')
      await mutate()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900">Pricing</h2>
      <p className="mt-1 text-xs text-gray-500">
        Read by booking-service. Applies to new bookings and new quotes. Existing bookings keep their price.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="block text-sm">
            <span className="font-medium text-gray-700">{f.label}</span>
            <input
              type="number"
              step="any"
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <span className="mt-0.5 block text-xs text-gray-400">{f.hint}</span>
          </label>
        ))}
      </div>

      <div className="mt-5 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="cursor-pointer rounded-md bg-[#1F6F5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#195c4f] disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save pricing'}
        </button>
      </div>
    </div>
  )
}