// components/verification/VerificationSkills.tsx  (spec 2.2c)
'use client'

import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { WorkerDocumentRow, WorkerSkillRow } from '@/types/worker'

interface Props {
  skills: WorkerSkillRow[]
  documents: WorkerDocumentRow[]
  yearsExperience: number
}

export default function VerificationSkills({ skills, documents, yearsExperience }: Props) {
  const certificates = documents.filter((d) => d.type === 'SKILL_CERTIFICATE').length

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Skill &amp; category claims
      </h2>

      {skills.length === 0 ? (
        <p className="text-sm text-gray-500">No skills claimed.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {skills.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2 text-sm"
            >
              <span className="font-medium text-gray-900">{s.categoryName ?? s.categoryId}</span>
              <span className="flex items-center gap-2 text-xs text-gray-500">
                {s.yearsExp} {s.yearsExp === 1 ? 'yr' : 'yrs'}
                {s.isVerified && <Badge tone="success">Verified</Badge>}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
        <p>
          Stated overall experience: {yearsExperience} {yearsExperience === 1 ? 'year' : 'years'}
        </p>
        <p className="mt-0.5">
          Certification documents:{' '}
          {certificates > 0 ? `${certificates} uploaded (see document review)` : 'none uploaded'}
        </p>
      </div>
    </Card>
  )
}