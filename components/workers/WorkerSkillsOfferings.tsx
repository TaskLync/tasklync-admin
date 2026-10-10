// components/workers/WorkerSkillsOfferings.tsx
'use client'

import { Card } from '@/components/ui/Card'
import { useWorkerCatalog } from '@/hooks/useWorkers'
import type { WorkerOfferingRow } from '@/types/worker'

function priceLabel(o: WorkerOfferingRow): string {
  if (o.priceType === 'quote') return 'Quote'
  const amount = `PKR ${o.customPrice.toLocaleString()}`
  return o.priceType === 'hourly' ? `${amount} / hr` : amount
}

export default function WorkerSkillsOfferings({ workerId }: { workerId: string }) {
  const { catalog, isLoading, error } = useWorkerCatalog(workerId)

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Skills &amp; Services</h2>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <div className="flex gap-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-5 w-20 animate-pulse rounded-full bg-gray-100" />
            ))}
          </div>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between rounded-md border border-gray-100 p-2">
              <div className="h-3.5 w-28 animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-16 animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
      ) : error || !catalog ? (
        <p className="text-sm text-gray-500">Couldn't load skills and services.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-xs font-medium text-gray-700">Skills</p>
            {catalog.skills.length === 0 ? (
              <p className="text-sm text-gray-500">No skills added.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {catalog.skills.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between rounded-md border border-gray-100 p-2 text-sm"
                  >
                    <span className="font-medium text-gray-900">{s.categoryName ?? s.categoryId}</span>
                    <span className="text-xs text-gray-400">
                      {s.yearsExp} {s.yearsExp === 1 ? 'yr' : 'yrs'}
                      {s.isVerified && ' · verified'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-gray-700">Service offerings</p>
            {catalog.offerings.length === 0 ? (
              <p className="text-sm text-gray-500">No service offerings yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {catalog.offerings.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between rounded-md border border-gray-100 p-2 text-sm"
                  >
                    <div>
                      <p className={o.isActive ? 'font-medium text-gray-900' : 'font-medium text-gray-400'}>
                        {o.name ?? 'Unnamed service'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {o.isCustom ? 'Custom' : 'Catalog'}
                        {!o.isActive && ' · inactive'}
                      </p>
                    </div>
                    <span className="text-xs text-gray-700">{priceLabel(o)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}