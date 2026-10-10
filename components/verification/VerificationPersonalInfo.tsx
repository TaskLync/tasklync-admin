// components/verification/VerificationPersonalInfo.tsx  (spec 2.2a)
'use client'

import { Card } from '@/components/ui/Card'
import { formatDate, timeAgo } from '@/components/workers/worker-ui'
import type { VerificationWorker } from '@/types/verification'

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm text-gray-900">
        {value ?? <span className="text-gray-400">Not provided</span>}
      </p>
    </div>
  )
}

export default function VerificationPersonalInfo({ worker }: { worker: VerificationWorker }) {
  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Personal information
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="Full name" value={worker.name} />
        <Field label="Phone" value={worker.phone && <span className="font-mono text-xs">{worker.phone}</span>} />
        <Field label="Email" value={worker.email} />
        <Field label="City" value={worker.city} />
        <Field label="Date of birth" value={worker.dateOfBirth ? formatDate(worker.dateOfBirth) : null} />
        <Field label="Account created" value={formatDate(worker.createdAt)} />
        <Field
          label="Registration IP"
          value={worker.registrationIp && <span className="font-mono text-xs">{worker.registrationIp}</span>}
        />
        <Field label="Last seen" value={worker.lastSeenAt ? timeAgo(worker.lastSeenAt) : null} />
        <Field
          label="Stated experience"
          value={`${worker.yearsExperience} ${worker.yearsExperience === 1 ? 'year' : 'years'}`}
        />
      </div>
      {worker.bio && (
        <p className="mt-4 border-t border-gray-100 pt-3 text-sm text-gray-600">{worker.bio}</p>
      )}
    </Card>
  )
}