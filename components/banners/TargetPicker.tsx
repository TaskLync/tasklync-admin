'use client'

import { useEffect, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { useBannerTargets } from '@/hooks/useBanners'
import type { CtaParamKind } from '@/lib/banner-constants'

const TYPE: Record<Exclude<CtaParamKind, 'url'>, string> = { category: 'CATEGORY', worker: 'WORKER', company: 'COMPANY' }
const NOUN: Record<Exclude<CtaParamKind, 'url'>, string> = { category: 'category', worker: 'verified worker', company: 'verified agency' }

/** Searchable list of real destinations (active categories, verified active workers / agencies). */
export default function TargetPicker({
  kind, value, onChange, disabled,
}: { kind: Exclude<CtaParamKind, 'url'>; value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250)
    return () => clearTimeout(t)
  }, [search])

  const { targets, isLoading, error } = useBannerTargets(TYPE[kind], debounced)
  // Resolve the saved id to a readable name even when it is not in the current search page.
  const { targets: current } = useBannerTargets(value ? TYPE[kind] : null, '', value)
  const selected = [...targets, ...current].find((t) => t.id === value)

  return (
    <div className="rounded-md border border-gray-300">
      <div className="flex items-center gap-2 border-b border-gray-200 px-2.5">
        <Search size={14} className="text-gray-400" />
        <input
          className="h-9 flex-1 bg-transparent text-sm focus:outline-none"
          placeholder={`Search ${NOUN[kind]}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={disabled}
        />
      </div>
      <ul className="max-h-48 overflow-y-auto py-1 text-sm" role="listbox">
        {isLoading && targets.length === 0 && <li className="px-3 py-2 text-xs text-gray-400">Loading…</li>}
        {error && <li className="px-3 py-2 text-xs text-red-600">Could not load the list.</li>}
        {!isLoading && !error && targets.length === 0 && (
          <li className="px-3 py-2 text-xs text-gray-500">No {NOUN[kind]} matches.</li>
        )}
        {targets.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              role="option"
              aria-selected={t.id === value}
              disabled={disabled}
              onClick={() => onChange(t.id)}
              className={`flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-gray-50 ${t.id === value ? 'bg-[#1F6F5F]/5' : ''}`}
            >
              <span>
                <span className="text-gray-900">{t.label}</span>
                {t.sub && <span className="ml-2 text-xs text-gray-400">{t.sub}</span>}
              </span>
              {t.id === value && <Check size={14} className="text-[#1F6F5F]" />}
            </button>
          </li>
        ))}
      </ul>
      <p className="border-t border-gray-200 px-3 py-1.5 text-xs text-gray-500">
        {value ? <>Selected: <span className="font-medium text-gray-800">{selected?.label ?? value}</span></> : `No ${NOUN[kind]} selected`}
      </p>
    </div>
  )
}
