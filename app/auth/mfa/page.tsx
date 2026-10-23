import { Suspense } from 'react'
import { MfaForm } from '@/components/auth/MfaForm'

export default function MfaPage() {
  return (
    <Suspense>
      <MfaForm />
    </Suspense>
  )
}