// components/disputes/DisputeParties.tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import type { DisputeDetail, DisputeParty } from '@/types/dispute'
import { initial } from './dispute-ui'

function Avatar({ url, name }: { url: string | null; name: string | null }) {
  return url ? (
    <Image
      src={url}
      alt=""
      width={40}
      height={40}
      unoptimized
      className="h-10 w-10 rounded-full object-cover"
    />
  ) : (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm text-gray-500">
      {initial(name)}
    </div>
  )
}

function Party({
  role,
  party,
  href,
  extra,
}: {
  role: string
  party: DisputeParty
  href: string | null
  extra?: string
}) {
  return (
    <div className="flex items-start gap-3">
      <Avatar url={party.avatarUrl} name={party.name} />
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-gray-400">{role}</p>
        {href ? (
          <Link
            href={href}
            className="font-medium text-gray-900 hover:text-[#1F6F5F] hover:underline"
          >
            {party.name ?? 'Unnamed'}
          </Link>
        ) : (
          <p className="font-medium text-gray-900">{party.name ?? 'Unknown'}</p>
        )}
        <p className="font-mono text-xs text-gray-500">{party.phone ?? '—'}</p>
        {extra && <p className="text-xs text-gray-400">{extra}</p>}
      </div>
    </div>
  )
}

export default function DisputeParties({ dispute }: { dispute: DisputeDetail }) {
  const { user, worker } = dispute

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Parties</h2>
      <div className="flex flex-col gap-4">
        <Party
          role="Customer (raised the dispute)"
          party={user}
          href={user.id ? `/users/${user.id}` : null}
        />
        <div className="border-t border-gray-100" />
        <Party
          role="Worker (dispute raised against)"
          party={worker}
          href={worker.id ? `/workers/${worker.id}` : null}
          extra={
            worker.totalReviews > 0
              ? `★ ${worker.avgRating.toFixed(1)} (${worker.totalReviews} reviews)`
              : 'No reviews yet'
          }
        />
      </div>
    </Card>
  )
}