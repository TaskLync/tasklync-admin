'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { ExplainQuery } from '@/hooks/useRanking'

export default function ExplainSearchForm({ value, busy, onApply }: { value: ExplainQuery; busy: boolean; onApply: (q: ExplainQuery) => void }) {
  const [d, setD] = useState<ExplainQuery>(value)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof ExplainQuery) => (e: React.ChangeEvent<HTMLInputElement>) => setD((p) => ({ ...p, [k]: e.target.value }))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const loc = [d.lat, d.lng, d.radius].filter((x) => x && x.trim() !== '').length
    if (loc > 0 && loc < 3) return setError('Latitude, longitude and radius must all be filled, or all empty.')
    if (d.categoryId && !/^[A-Za-z0-9_-]{1,50}$/.test(d.categoryId)) return setError('Category id can only contain letters, numbers, - and _.')
    setError(null)
    onApply(d)
  }

  return (
    <Card className="p-4">
      <form onSubmit={submit}>
        <p className="mb-3 text-sm text-gray-500">
          Pick the search this worker should be explained for. Leave everything empty to explain the plain category browse.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Search text" placeholder="ac repair" value={d.q ?? ''} onChange={set('q')} />
          <Input label="Category id" placeholder="ac_repair" value={d.categoryId ?? ''} onChange={set('categoryId')} />
          <Input label="City" placeholder="Lahore" value={d.city ?? ''} onChange={set('city')} />
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-gray-700">Add a customer location (optional)</summary>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input label="Latitude" placeholder="31.5204" value={d.lat ?? ''} onChange={set('lat')} />
            <Input label="Longitude" placeholder="74.3587" value={d.lng ?? ''} onChange={set('lng')} />
            <Input label="Radius (metres, max 50000)" placeholder="10000" value={d.radius ?? ''} onChange={set('radius')} />
          </div>
        </details>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <div className="mt-3 flex justify-end">
          <Button type="submit" loading={busy}>Explain</Button>
        </div>
      </form>
    </Card>
  )
}