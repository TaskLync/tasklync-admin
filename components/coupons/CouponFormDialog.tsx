'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { couponActions } from '@/hooks/useCoupons'
import { HIGH_BUDGET_HINT_PKR, MAX_FIXED_PKR, MAX_PERCENT } from '@/lib/coupon-constants'

const num = (s: string) => (s.trim() === '' ? undefined : Number(s))
const iso = (local: string) => (local ? new Date(local).toISOString() : '')

export default function CouponFormDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = useState<'single' | 'batch'>('single')
  const [f, setF] = useState({
    code: '', prefix: '', count: '100', title: '', discountType: 'FIXED', discountValue: '', maxDiscount: '',
    minBooking: '0', categories: '', firstBooking: false, startsAt: '', endsAt: '', maxRedemptions: '', perUser: '1', budget: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }))

  async function submit() {
    setError(null)
    setBusy(true)
    try {
      const base = {
        title: f.title.trim(), discountType: f.discountType, discountValue: Number(f.discountValue),
        maxDiscountAmount: num(f.maxDiscount), minBookingAmount: Number(f.minBooking || 0),
        scopeCategoryIds: f.categories.split(',').map((s) => s.trim()).filter(Boolean),
        firstBookingOnly: f.firstBooking, startsAt: iso(f.startsAt), endsAt: iso(f.endsAt), perUserLimit: Number(f.perUser || 1),
      }
      if (mode === 'single') {
        await couponActions.create({ ...base, code: f.code.trim(), maxRedemptions: num(f.maxRedemptions), budgetCapPkr: num(f.budget) })
        toast.success('Coupon created')
        onSaved()
      } else {
        const out = await couponActions.batch({ ...base, prefix: f.prefix.trim(), count: Number(f.count) })
        setCodes(out.codes) // shown once
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function download() {
    const blob = new Blob([`code\n${(codes ?? []).join('\n')}\n`], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `coupons-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (codes) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">{codes.length} codes created</h2>
          <p className="mt-1 text-sm text-amber-700">Download them now. They are shown only once.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={download}>Download CSV</Button>
            <Button onClick={onSaved}>Done</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">New coupon</h2>
        <div className="mt-3 flex rounded-md border border-gray-300 p-0.5 text-sm">
          {(['single', 'batch'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`h-8 flex-1 rounded ${mode === m ? 'bg-[#1F6F5F]/10 font-medium text-[#1F6F5F]' : 'text-gray-500'}`}>
              {m === 'single' ? 'One code' : 'Batch of single-use codes'}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {mode === 'single' ? (
            <Input label="Code" placeholder="EID26" value={f.code} onChange={(e) => set('code', e.target.value)} helperText="4 to 16 letters, digits or dashes" />
          ) : (
            <>
              <Input label="Prefix (optional)" placeholder="EID" value={f.prefix} onChange={(e) => set('prefix', e.target.value)} />
              <Input label="How many" type="number" value={f.count} onChange={(e) => set('count', e.target.value)} helperText="Up to 5,000" />
            </>
          )}
          <Input label="Title (internal)" value={f.title} onChange={(e) => set('title', e.target.value)} />
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Type</label>
            <select className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm" value={f.discountType} onChange={(e) => set('discountType', e.target.value)}>
              <option value="FIXED">Fixed (PKR)</option>
              <option value="PERCENT">Percent</option>
            </select>
          </div>
          <Input label={f.discountType === 'PERCENT' ? `Percent (max ${MAX_PERCENT})` : `Amount (max PKR ${MAX_FIXED_PKR})`} type="number" value={f.discountValue} onChange={(e) => set('discountValue', e.target.value)} />
          <Input label={mode === 'batch' ? 'Max discount per code (PKR, required)' : 'Max discount (PKR, optional)'} type="number" value={f.maxDiscount} onChange={(e) => set('maxDiscount', e.target.value)} />
          <Input label="Minimum job amount (PKR)" type="number" value={f.minBooking} onChange={(e) => set('minBooking', e.target.value)} />
          <Input label="Categories (ids, comma separated, empty = all)" value={f.categories} onChange={(e) => set('categories', e.target.value)} />
          <Input label="Starts" type="datetime-local" value={f.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
          <Input label="Ends" type="datetime-local" value={f.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
          <Input label="Uses per customer" type="number" value={f.perUser} onChange={(e) => set('perUser', e.target.value)} />
          {mode === 'single' && (
            <>
              <Input label="Total uses (optional)" type="number" value={f.maxRedemptions} onChange={(e) => set('maxRedemptions', e.target.value)} />
              <Input label="Budget cap (PKR)" type="number" value={f.budget} onChange={(e) => set('budget', e.target.value)} helperText={`No cap, or above PKR ${HIGH_BUDGET_HINT_PKR.toLocaleString()}, needs a second approver`} />
            </>
          )}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="accent-[#1F6F5F]" checked={f.firstBooking} onChange={(e) => set('firstBooking', e.target.checked)} />
          First booking only
        </label>
        <p className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
          Until subsidy mode is enabled in booking-service, a discount is capped at the platform take (about 10 percent of the job value). The worker is always paid in full.
        </p>

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !f.title.trim() || !f.discountValue || !f.startsAt || !f.endsAt || (mode === 'single' ? !f.code.trim() : !f.maxDiscount)}>
            {busy ? 'Saving…' : mode === 'single' ? 'Create' : 'Generate'}
          </Button>
        </div>
      </div>
    </div>
  )
}