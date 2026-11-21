'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { usePricingConfig, usePricingHistory, pricingConfigActions } from '@/hooks/useCategories'
import type { PricingConfig, TaxAppliesTo } from '@/types/category'

type Form = {
  customerFeeEnabled: boolean
  customerFeePercent: string
  workerCommissionEnabled: boolean
  workerCommissionPercent: string
  taxEnabled: boolean
  taxPercent: string
  taxLabel: string
  taxAppliesTo: TaxAppliesTo
  cancellationFeesEnabled: boolean
  cancelFeeOver24hPercent: string
  cancelFeeWithin24hPercent: string
  cancelFeeAfterArrivalPercent: string
  noShowFeeEnabled: boolean
  noShowFeePkr: string
  demandThreshold: string
  demandMultiplier: string
  offPeakMultiplier: string
}

const toForm = (c: PricingConfig): Form => ({
  customerFeeEnabled: c.customerFeeEnabled,
  customerFeePercent: String(c.customerFeePercent),
  workerCommissionEnabled: c.workerCommissionEnabled,
  workerCommissionPercent: String(c.workerCommissionPercent),
  taxEnabled: c.taxEnabled,
  taxPercent: String(c.taxPercent),
  taxLabel: c.taxLabel,
  taxAppliesTo: c.taxAppliesTo,
  cancellationFeesEnabled: c.cancellationFeesEnabled,
  cancelFeeOver24hPercent: String(c.cancelFeeOver24hPercent),
  cancelFeeWithin24hPercent: String(c.cancelFeeWithin24hPercent),
  cancelFeeAfterArrivalPercent: String(c.cancelFeeAfterArrivalPercent),
  noShowFeeEnabled: c.noShowFeeEnabled,
  noShowFeePkr: String(c.noShowFeePkr),
  demandThreshold: String(c.demandThreshold),
  demandMultiplier: String(c.demandMultiplier),
  offPeakMultiplier: String(c.offPeakMultiplier),
})

const pkr = (n: number) => `PKR ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
const pct = (on: boolean, v: string) => (on && Number(v) > 0 ? `${Number(v)}%` : 'Free')
const cancelText = (f: Form) =>
  f.cancellationFeesEnabled
    ? `${pct(true, f.cancelFeeOver24hPercent)} / ${pct(true, f.cancelFeeWithin24hPercent)} / ${pct(true, f.cancelFeeAfterArrivalPercent)}`
    : 'Free'
const noShowText = (f: Form) => (f.noShowFeeEnabled && Number(f.noShowFeePkr) > 0 ? pkr(Number(f.noShowFeePkr)) : 'Free')

/**
 * Example breakdown for the admin only (same formula booking-service uses: computeFees).
 * Real prices are always calculated and stored by booking-service.
 */
function example(f: Form, service = 1000) {
  const p = (x: number, rate: number) => Math.round(x * 100 * rate) / 10000
  const fee = f.customerFeeEnabled ? p(service, Number(f.customerFeePercent) || 0) : 0
  const commission = f.workerCommissionEnabled ? p(service, Number(f.workerCommissionPercent) || 0) : 0
  const taxBase = f.taxAppliesTo === 'subtotal_and_fee' ? service + fee : service
  const tax = f.taxEnabled ? p(taxBase, Number(f.taxPercent) || 0) : 0
  return { service, fee, tax, total: service + fee + tax, commission, earnings: service - commission }
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
        on ? 'bg-[#1F6F5F]' : 'bg-gray-300'
      }`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

function NumberField({
  label, value, onChange, suffix, disabled, hint,
}: { label: string; value: string; onChange: (v: string) => void; suffix?: string; disabled?: boolean; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-gray-700">{label}</span>
      <div className="mt-1 flex items-center rounded-md border border-gray-300 bg-white focus-within:ring-1 focus-within:ring-[#1F6F5F]">
        <input
          type="number"
          step="any"
          min={0}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md px-3 py-2 text-sm outline-none disabled:bg-gray-50 disabled:text-gray-400"
        />
        {suffix ? <span className="pr-3 text-sm text-gray-400">{suffix}</span> : null}
      </div>
      {hint ? <span className="mt-0.5 block text-xs text-gray-400">{hint}</span> : null}
    </label>
  )
}

function Section({
  title, description, on, onToggle, children,
}: { title: string; description: string; on: boolean; onToggle: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="mt-0.5 text-xs text-gray-500">{description}</p>
        </div>
        <Toggle on={on} onChange={onToggle} label={title} />
      </div>
      <div className={`mt-3 grid gap-3 sm:grid-cols-2 ${on ? '' : 'opacity-60'}`}>{children}</div>
    </div>
  )
}

export default function PricingSettings() {
  const { config, isLoading, mutate } = usePricingConfig()
  const { history, mutate: mutateHistory } = usePricingHistory()
  const [form, setForm] = useState<Form | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (config) setForm(toForm(config))
  }, [config])

  const changes = useMemo(() => {
    if (!config || !form) return []
    const base = toForm(config)
    const list: string[] = []
    if (base.customerFeeEnabled !== form.customerFeeEnabled || Number(base.customerFeePercent) !== Number(form.customerFeePercent))
      list.push(`Customer platform fee: ${pct(base.customerFeeEnabled, base.customerFeePercent)} → ${pct(form.customerFeeEnabled, form.customerFeePercent)}`)
    if (base.workerCommissionEnabled !== form.workerCommissionEnabled || Number(base.workerCommissionPercent) !== Number(form.workerCommissionPercent))
      list.push(`Worker commission: ${pct(base.workerCommissionEnabled, base.workerCommissionPercent)} → ${pct(form.workerCommissionEnabled, form.workerCommissionPercent)}`)
    if (base.taxEnabled !== form.taxEnabled || Number(base.taxPercent) !== Number(form.taxPercent) || base.taxLabel !== form.taxLabel || base.taxAppliesTo !== form.taxAppliesTo)
      list.push(`Tax: ${base.taxEnabled ? `${base.taxLabel} ${Number(base.taxPercent)}%` : 'Off'} → ${form.taxEnabled ? `${form.taxLabel} ${Number(form.taxPercent)}%` : 'Off'}`)
    if (cancelText(base) !== cancelText(form))
      list.push(`Cancellation fee (over 24h / within 24h / after arrival): ${cancelText(base)} → ${cancelText(form)}`)
    if (noShowText(base) !== noShowText(form))
      list.push(`Customer no-show fee: ${noShowText(base)} → ${noShowText(form)}`)
    if (Number(base.demandThreshold) !== Number(form.demandThreshold) || Number(base.demandMultiplier) !== Number(form.demandMultiplier))
      list.push(`Demand surge: ${base.demandMultiplier}x under ${base.demandThreshold} workers → ${form.demandMultiplier}x under ${form.demandThreshold} workers`)
    if (Number(base.offPeakMultiplier) !== Number(form.offPeakMultiplier))
      list.push(`Off-peak multiplier: ${base.offPeakMultiplier} → ${form.offPeakMultiplier}`)
    return list
  }, [config, form])

  if (isLoading || !form || !config) return <div className="h-40 animate-pulse rounded-lg bg-gray-100" />

  const ex = example(form)
  const set = (patch: Partial<Form>) => setForm({ ...form, ...patch })

  async function save() {
    if (!form || !config) return
    setSaving(true)
    try {
      await pricingConfigActions.update({
        customerFeeEnabled: form.customerFeeEnabled,
        customerFeePercent: Number(form.customerFeePercent),
        workerCommissionEnabled: form.workerCommissionEnabled,
        workerCommissionPercent: Number(form.workerCommissionPercent),
        taxEnabled: form.taxEnabled,
        taxPercent: Number(form.taxPercent),
        taxLabel: form.taxLabel,
        taxAppliesTo: form.taxAppliesTo,
        cancellationFeesEnabled: form.cancellationFeesEnabled,
        cancelFeeOver24hPercent: Number(form.cancelFeeOver24hPercent),
        cancelFeeWithin24hPercent: Number(form.cancelFeeWithin24hPercent),
        cancelFeeAfterArrivalPercent: Number(form.cancelFeeAfterArrivalPercent),
        noShowFeeEnabled: form.noShowFeeEnabled,
        noShowFeePkr: Number(form.noShowFeePkr),
        demandThreshold: Number(form.demandThreshold),
        demandMultiplier: Number(form.demandMultiplier),
        offPeakMultiplier: Number(form.offPeakMultiplier),
        expectedVersion: config.version,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      })
      toast.success('Saved. New bookings and quotes use these prices within about a minute.')
      setConfirming(false)
      setReason('')
      await Promise.all([mutate(), mutateHistory()])
    } catch (e) {
      toast.error((e as Error).message)
      await mutate() // e.g. 409: someone else saved first; show their values
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Pricing &amp; Commission</h2>
          <p className="mt-1 text-xs text-gray-500">
            Applies to new bookings and new quotes. Existing bookings and quotes already sent keep their price.
          </p>
        </div>
        <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
          Version {config.version} · since {new Date(config.effectiveFrom).toLocaleString()}
        </span>
      </div>

      <div className="mt-4 grid gap-4">
        <Section
          title="Customer platform fee"
          description="Added on top of the service price. Customers see “Platform fee: FREE” when this is off or 0%."
          on={form.customerFeeEnabled}
          onToggle={(v) => set({ customerFeeEnabled: v })}
        >
          <NumberField label="Fee" suffix="%" value={form.customerFeePercent} disabled={!form.customerFeeEnabled}
            onChange={(v) => set({ customerFeePercent: v })} hint="0 to 30%" />
        </Section>

        <Section
          title="Worker commission"
          description="Deducted from the worker’s earnings. Workers see “No commission” when this is off or 0%."
          on={form.workerCommissionEnabled}
          onToggle={(v) => set({ workerCommissionEnabled: v })}
        >
          <NumberField label="Commission" suffix="%" value={form.workerCommissionPercent} disabled={!form.workerCommissionEnabled}
            onChange={(v) => set({ workerCommissionPercent: v })} hint="0 to 30%" />
        </Section>

        <Section
          title="Tax"
          description="Added to the customer’s bill as its own line. Never deducted from worker earnings."
          on={form.taxEnabled}
          onToggle={(v) => set({ taxEnabled: v })}
        >
          <NumberField label="Rate" suffix="%" value={form.taxPercent} disabled={!form.taxEnabled}
            onChange={(v) => set({ taxPercent: v })} hint="0 to 50%" />
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Label on the bill</span>
            <input
              value={form.taxLabel}
              maxLength={40}
              disabled={!form.taxEnabled}
              onChange={(e) => set({ taxLabel: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-gray-700">Applies to</span>
            <select
              value={form.taxAppliesTo}
              disabled={!form.taxEnabled}
              onChange={(e) => set({ taxAppliesTo: e.target.value as TaxAppliesTo })}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-50"
            >
              <option value="subtotal">Service amount</option>
              <option value="subtotal_and_fee">Service amount + platform fee</option>
            </select>
          </label>
        </Section>

        <Section
          title="Customer cancellation fee"
          description="Share of the total kept when the customer cancels after the worker accepted. Cancelling before acceptance is always free. Customers see “No cancellation fee” when this is off."
          on={form.cancellationFeesEnabled}
          onToggle={(v) => set({ cancellationFeesEnabled: v })}
        >
          <NumberField label="More than 24h before" suffix="%" value={form.cancelFeeOver24hPercent} disabled={!form.cancellationFeesEnabled}
            onChange={(v) => set({ cancelFeeOver24hPercent: v })} hint="0 to 100%" />
          <NumberField label="24h or less before" suffix="%" value={form.cancelFeeWithin24hPercent} disabled={!form.cancellationFeesEnabled}
            onChange={(v) => set({ cancelFeeWithin24hPercent: v })} hint="0 to 100%" />
          <NumberField label="Worker already at the site" suffix="%" value={form.cancelFeeAfterArrivalPercent} disabled={!form.cancellationFeesEnabled}
            onChange={(v) => set({ cancelFeeAfterArrivalPercent: v })} hint="0 to 100%" />
        </Section>

        <Section
          title="Customer no-show fee"
          description="Recorded when the worker reports the customer was not at the job site. Never more than the booking total."
          on={form.noShowFeeEnabled}
          onToggle={(v) => set({ noShowFeeEnabled: v })}
        >
          <NumberField label="Fee" suffix="PKR" value={form.noShowFeePkr} disabled={!form.noShowFeeEnabled}
            onChange={(v) => set({ noShowFeePkr: v })} hint="0 to 100,000" />
        </Section>

        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900">Demand surge</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <NumberField label="Applies under (workers)" value={form.demandThreshold} onChange={(v) => set({ demandThreshold: v })} />
            <NumberField label="Multiplier" value={form.demandMultiplier} onChange={(v) => set({ demandMultiplier: v })} hint="1.2 = +20%" />
            <NumberField label="Off-peak multiplier" value={form.offPeakMultiplier} onChange={(v) => set({ offPeakMultiplier: v })} hint="Stored, not applied yet" />
          </div>
        </div>

        <div className="rounded-lg bg-gray-50 p-4 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Example: {pkr(ex.service)} job</p>
          <div className="mt-2 grid gap-6 sm:grid-cols-2">
            <dl className="space-y-1">
              <div className="flex justify-between"><dt className="text-gray-500">Customer: service</dt><dd>{pkr(ex.service)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Platform fee</dt><dd>{ex.fee ? pkr(ex.fee) : 'FREE'}</dd></div>
              {form.taxEnabled ? <div className="flex justify-between"><dt className="text-gray-500">{form.taxLabel}</dt><dd>{pkr(ex.tax)}</dd></div> : null}
              <div className="flex justify-between font-semibold"><dt>Customer pays</dt><dd>{pkr(ex.total)}</dd></div>
            </dl>
            <dl className="space-y-1">
              <div className="flex justify-between"><dt className="text-gray-500">Worker: service</dt><dd>{pkr(ex.service)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Commission</dt><dd>{ex.commission ? `− ${pkr(ex.commission)}` : 'No commission'}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Worker earns</dt><dd>{pkr(ex.earnings)}</dd></div>
            </dl>
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          onClick={() => setConfirming(true)}
          disabled={changes.length === 0}
          className="cursor-pointer rounded-md bg-[#1F6F5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#195c4f] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Review and save
        </button>
      </div>

      {history.length > 0 ? (
        <div className="mt-6 border-t border-gray-100 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Change history</h3>
          <ul className="mt-2 divide-y divide-gray-100 text-sm">
            {history.map((h) => (
              <li key={h.version} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="text-gray-700">
                  v{h.version}: fee {h.customerFeeEnabled ? `${h.customerFeePercent}%` : 'off'}, commission{' '}
                  {h.workerCommissionEnabled ? `${h.workerCommissionPercent}%` : 'off'}, tax {h.taxEnabled ? `${h.taxPercent}%` : 'off'},
                  cancellation fee {h.cancellationFeesEnabled ? 'on' : 'off'}, no-show fee {h.noShowFeeEnabled ? 'on' : 'off'}
                  {h.reason ? <span className="text-gray-400"> · {h.reason}</span> : null}
                </span>
                <span className="text-xs text-gray-400">
                  {h.changedByEmail ?? 'system'} · {new Date(h.changedAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">Change pricing?</h3>
            <p className="mt-1 text-sm text-gray-500">
              New bookings and quotes use this within about a minute. Existing bookings are not changed.
            </p>
            <ul className="mt-3 space-y-1 rounded-md bg-gray-50 p-3 text-sm text-gray-800">
              {changes.map((c) => <li key={c}>{c}</li>)}
            </ul>
            <label className="mt-3 block text-sm">
              <span className="font-medium text-gray-700">Note (optional)</span>
              <input
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Zero-commission launch"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={saving}
                className="cursor-pointer rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="cursor-pointer rounded-md bg-[#1F6F5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#195c4f] disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Confirm and save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
