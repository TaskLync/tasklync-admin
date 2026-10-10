// components/verification/VerificationCnicCheck.tsx  (spec 2.2b: CNIC number + duplicate check)
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { usePermission } from '@/hooks/usePermission'
import { verificationActions } from '@/hooks/useVerification'
import { VERIFICATION_LABEL, VERIFICATION_VARIANT } from '@/components/workers/worker-ui'
import { CNIC_RE, formatCnic, normalizeCnic } from '@/lib/verification-constants'
import type { CnicDuplicate } from '@/types/verification'

interface Props {
  workerId: string
  cnicNumber: string | null
  duplicates: CnicDuplicate[]
  onChanged: () => void
}

export default function VerificationCnicCheck({ workerId, cnicNumber, duplicates, onChanged }: Props) {
  const canEdit = usePermission('workers:verify')
  const [value, setValue] = useState(cnicNumber ? formatCnic(cnicNumber) : '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValue(cnicNumber ? formatCnic(cnicNumber) : '')
  }, [cnicNumber])

  const digits = normalizeCnic(value)
  const formatOk = digits === '' || CNIC_RE.test(digits)
  const unchanged = digits === (cnicNumber ?? '')

  async function save() {
    setSaving(true)
    try {
      const res = await verificationActions.saveCnic(workerId, digits)
      toast.success(
        res.duplicates.length > 0 ? 'CNIC saved: duplicate found' : 'CNIC saved: no duplicates'
      )
      onChanged()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        CNIC number &amp; duplicate check
      </h2>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-xs">
          <Input
            label="CNIC number (read it from the image)"
            placeholder="35202-1234567-1"
            inputMode="numeric"
            value={value}
            disabled={!canEdit}
            onChange={(e) => setValue(e.target.value)}
            error={!formatOk ? 'CNIC must be exactly 13 digits' : undefined}
            helperText={formatOk ? '13 digits, dashes optional' : undefined}
          />
        </div>
        {canEdit && (
          <Button
            variant="secondary"
            loading={saving}
            disabled={!formatOk || unchanged}
            onClick={save}
          >
            Save &amp; check
          </Button>
        )}
      </div>

      <div className="mt-3 text-sm">
        {!cnicNumber ? (
          <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
            Not checked yet. Enter the CNIC number from the image to run the duplicate check.
          </p>
        ) : duplicates.length === 0 ? (
          <p className="rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">
            No other account uses {formatCnic(cnicNumber)}.
          </p>
        ) : (
          <div className="rounded-md bg-red-50 px-3 py-2">
            <p className="text-xs font-medium text-red-700">
              Duplicate: {duplicates.length} other {duplicates.length === 1 ? 'account uses' : 'accounts use'}{' '}
              this CNIC. Approving is blocked.
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {duplicates.map((d) => (
                <li key={d.id} className="flex items-center gap-2 text-xs text-red-700">
                  <Link href={`/workers/${d.id}`} className="font-medium underline">
                    {d.name ?? 'Unnamed'}
                  </Link>
                  <span className="font-mono">{d.phone ?? '—'}</span>
                  <StatusBadge
                    status={d.verificationStatus}
                    variant={VERIFICATION_VARIANT[d.verificationStatus] ?? 'neutral'}
                    label={VERIFICATION_LABEL[d.verificationStatus] ?? d.verificationStatus}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  )
}