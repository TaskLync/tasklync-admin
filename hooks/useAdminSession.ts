'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminUser } from '@/types/auth'

export function useAdminSession() {
  const router = useRouter()
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchWithAuth = useCallback(async (input: RequestInfo, init: RequestInit = {}) => {
    let token = sessionStorage.getItem('admin_access_token')
    let res = await fetch(input, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } })

    if (res.status === 401) {
      const refreshRes = await fetch('/api/admin/auth/refresh', { method: 'POST' })
      if (!refreshRes.ok) {
        router.push('/auth/login')
        throw new Error('Session expired')
      }
      const { accessToken } = await refreshRes.json()
      sessionStorage.setItem('admin_access_token', accessToken)
      res = await fetch(input, { ...init, headers: { ...init.headers, Authorization: `Bearer ${accessToken}` } })
    }
    return res
  }, [router])

  useEffect(() => {
    fetchWithAuth('/api/admin/auth/session')
      .then((r) => r.json())
      .then(setAdmin)
      .catch(() => setAdmin(null))
      .finally(() => setLoading(false))
  }, [fetchWithAuth])

  return { admin, loading, fetchWithAuth }
}