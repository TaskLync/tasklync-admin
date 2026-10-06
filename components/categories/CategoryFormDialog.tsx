'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { categoryActions } from '@/hooks/useCategories'
import type { CategoryListItem } from '@/types/category'

interface Props {
  mode: 'create' | 'edit'
  category?: CategoryListItem
  onClose: () => void
  onSaved: () => void
}

export default function CategoryFormDialog({ mode, category, onClose, onSaved }: Props) {
  const [id, setId] = useState(category?.id ?? '')
  const [name, setName] = useState(category?.name ?? '')
  const [nameUr, setNameUr] = useState(category?.nameUr ?? '')
  const [iconUrl, setIconUrl] = useState(category?.iconUrl ?? '')
  const [sortOrder, setSortOrder] = useState(category?.sortOrder ?? 0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    setSubmitting(true)
    try {
      const input = { id: id.trim(), name: name.trim(), nameUr: nameUr.trim() || null, iconUrl: iconUrl.trim() || null, sortOrder }
      if (mode === 'create') {
        await categoryActions.create(input)
        toast.success('Category created')
      } else {
        await categoryActions.update(category!.id, input)
        toast.success('Category updated')
      }
      onSaved()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">
          {mode === 'create' ? 'New Category' : `Edit ${category?.name}`}
        </h2>

        <div className="mt-4 flex flex-col gap-3">
          <Input
            label="Category ID"
            placeholder="ac-repair"
            value={id}
            onChange={(e) => setId(e.target.value)}
            disabled={mode === 'edit'}
            helperText={mode === 'create' ? 'Lowercase letters, numbers, hyphens only. Cannot be changed later.' : undefined}
          />
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Name (Urdu)" value={nameUr} onChange={(e) => setNameUr(e.target.value)} />
          <Input label="Icon URL" value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} />
          <Input
            label="Sort order"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
          />
        </div>

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !id.trim() || !name.trim()}>
            {submitting ? 'Saving…' : mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}