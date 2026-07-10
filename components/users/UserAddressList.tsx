// components/users/UserAddressList.tsx
'use client'

import { Card } from '@/components/ui/Card'
import { useUserAddresses } from '@/hooks/useUsers'

export default function UserAddressList({ userId }: { userId: string }) {
  const { addresses, isLoading } = useUserAddresses(userId)

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Addresses</h2>
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-md border border-gray-100 p-3">
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-24 animate-pulse rounded bg-gray-100" />
                <div className="h-4 w-14 animate-pulse rounded-full bg-gray-100" />
              </div>
              <div className="mt-2 h-3 w-48 animate-pulse rounded bg-gray-100" />
              <div className="mt-1.5 h-2.5 w-32 animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
      ) : addresses.length === 0 ? (
        <p className="text-sm text-gray-500">No saved addresses.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {addresses.map((a) => (
            <li key={a.id} className="rounded-md border border-gray-100 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">{a.label}</span>
                {a.isDefault && (
                  <span className="rounded-full bg-[--accent]/10 px-2 py-0.5 text-xs font-medium text-[--accent]">
                    Default
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-gray-600">{a.addressLine}</p>
              <p className="text-xs text-gray-400">{[a.city, a.country].filter(Boolean).join(', ') || '—'}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}