'use client'

import { useCallback } from 'react'
import useSWR from 'swr'
import { fetcher } from '@/lib/swr-fetcher'
import type { AdminUser } from '@/types/auth'

type SessionAdmin = AdminUser & { mfaSetupRequired?: boolean }

// One shared request for Header + Sidebar + usePermission (SWR dedupes it).
// Token refresh is handled globally by lib/auth-fetch.ts (installed in SessionKeeper).
export function useAdminSession() {
  const { data, isLoading } = useSWR<SessionAdmin>('/api/admin/auth/session', fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    dedupingInterval: 60_000,
  })

  // Kept for backwards compatibility with any caller that still uses it.
  const fetchWithAuth = useCallback(
    (input: RequestInfo | URL, init: RequestInit = {}) => fetch(input, { ...init, credentials: 'same-origin' }),
    []
  )

  return { admin: data ?? null, loading: isLoading, fetchWithAuth }
}