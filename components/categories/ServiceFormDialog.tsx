'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { serviceActions } from '@/hooks/useCategories'
import type { ServiceItem, PriceType } from '@/types/category'

interface Props {
  mode: 'create' | 'edit'
  categoryId: string
  service?: ServiceItem
  onClose: () => void
  onSaved: () => void
}

export default function ServiceFormDialog({ mode, categoryId, service, onClose, onSaved }: Props) {
  const [name, setName] = useState(service?.name ?? '')
  const [nameUr, setNameUr] = useState(service?.nameUr ?? '')
  const [description, setDescription] = useState(service?.description ?? '')
  const [priceType, setPriceType] = useState<PriceType>(service?.priceType ?? 'fixed')
  const [basePrice, setBasePrice] = useState<string>(service?.basePrice?.toString() ?? '')
  const [minDurationMins, setMinDurationMins] = useState(service?.minDurationMins ?? 30)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    setSubmitting(true)
    try {
      const input = {
        name: name.trim(),
        nameUr: nameUr.trim() || null,
        description: description.trim() || null,
        priceType,
        basePrice: priceType === 'quote' ? null : Number(basePrice),
        minDurationMins,
      }
      if (mode === 'create') {
        await serviceActions.create(categoryId, input)
        toast.success('Service created')
      } else {
        await serviceActions.update(categoryId, service!.id, input)
        toast.success('Service updated')
      }
      onSaved()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const priceValid = priceType === 'quote' || (basePrice.trim() !== '' && Number(basePrice) >= 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">
          {mode === 'create' ? 'Add Service' : `Edit ${service?.name}`}
        </h2>

        <div className="mt-4 flex flex-col gap-3">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Name (Urdu)" value={nameUr} onChange={(e) => setNameUr(e.target.value)} />

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Description</label>
            <textarea
              className="h-20 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[--accent]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Price type</label>
            <select
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm"
              value={priceType}
              onChange={(e) => setPriceType(e.target.value as PriceType)}
            >
              <option value="fixed">Fixed</option>
              <option value="hourly">Hourly</option>
              <option value="quote">By quote</option>
            </select>
          </div>

          {priceType !== 'quote' && (
            <Input
              label={`Base price (PKR${priceType === 'hourly' ? ' / hour' : ''})`}
              type="number"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
            />
          )}

          <Input
            label="Minimum duration (minutes)"
            type="number"
            value={minDurationMins}
            onChange={(e) => setMinDurationMins(Number(e.target.value))}
          />
        </div>

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !name.trim() || !priceValid}>
            {submitting ? 'Saving…' : mode === 'create' ? 'Add' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}