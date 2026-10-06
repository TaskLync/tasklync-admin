'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { usePermission } from '@/hooks/usePermission'
import { usePricingConfig, pricingConfigActions } from '@/hooks/useCategories'

function FieldSkeleton() {
  return (
    <div className="flex flex-col gap-1">
      <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
      <div className="h-9 w-full animate-pulse rounded bg-gray-100" />
    </div>
  )
}

export default function PricingConfigPanel() {
  const { config, isLoading, error, mutate } = usePricingConfig()
  const canEdit = usePermission('settings:edit')
  const [form, setForm] = useState(config)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (config) setForm(config)
  }, [config])

  if (error) {
    return (
      <Card className="p-4 text-sm text-red-600">
        Couldn't load pricing configuration.{' '}
        <button className="underline" onClick={() => mutate()}>Retry</button>
      </Card>
    )
  }

  if (isLoading || !form) {
    return (
      <Card className="flex flex-col gap-3 p-4">
        <div className="h-4 w-48 animate-pulse rounded bg-gray-100" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => <FieldSkeleton key={i} />)}
        </div>
      </Card>
    )
  }

  async function handleSave() {
    if (!form) return
    setSubmitting(true)
    try {
      await pricingConfigActions.update(form)
      toast.success('Pricing configuration updated')
      mutate()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="p-4">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Dynamic Pricing Configuration
      </h2>
      <p className="mb-4 text-xs text-gray-400">
        Global multipliers used by the booking pricing engine. SUPER_ADMIN only.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Platform fee (%)"
          type="number"
          value={form.platformFeePercent}
          disabled={!canEdit}
          onChange={(e) => setForm({ ...form, platformFeePercent: Number(e.target.value) })}
        />
        <Input
          label="Demand threshold (workers)"
          type="number"
          value={form.demandThreshold}
          disabled={!canEdit}
          onChange={(e) => setForm({ ...form, demandThreshold: Number(e.target.value) })}
        />
        <Input
          label="Low-demand multiplier"
          type="number"
          step="0.01"
          value={form.demandMultiplier}
          disabled={!canEdit}
          onChange={(e) => setForm({ ...form, demandMultiplier: Number(e.target.value) })}
        />
        <Input
          label="Same-day urgency multiplier"
          type="number"
          step="0.01"
          value={form.urgencySameDayMultiplier}
          disabled={!canEdit}
          onChange={(e) => setForm({ ...form, urgencySameDayMultiplier: Number(e.target.value) })}
        />
        <Input
          label="Within-2h urgency multiplier"
          type="number"
          step="0.01"
          value={form.urgencyWithin2hMultiplier}
          disabled={!canEdit}
          onChange={(e) => setForm({ ...form, urgencyWithin2hMultiplier: Number(e.target.value) })}
        />
        <Input
          label="Off-peak multiplier"
          type="number"
          step="0.01"
          value={form.offPeakMultiplier}
          disabled={!canEdit}
          onChange={(e) => setForm({ ...form, offPeakMultiplier: Number(e.target.value) })}
        />
      </div>

      {canEdit && (
        <div className="mt-5 flex justify-end">
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      )}

      <p className="mt-4 text-xs text-gray-400">
        Last updated {new Date(form.updatedAt).toLocaleString('en-GB')}. Changes here only take effect
        once booking-service reads from this table instead of its env vars — coordinate before relying
        on this in production.
      </p>
    </Card>
  )
}