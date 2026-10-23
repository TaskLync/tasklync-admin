'use client'

import { useEffect } from 'react'
import { installFetchInterceptor, refreshSession, getLastRefreshAt } from '@/lib/auth-fetch'

// Runs at import time on the client, before any child effect fires its first request.
installFetchInterceptor()

const REFRESH_EVERY_MS = 10 * 60 * 1000 // access token lives 15 min

export function SessionKeeper() {
  useEffect(() => {
    const refreshIfStale = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - getLastRefreshAt() < REFRESH_EVERY_MS) return
      void refreshSession(true)
    }

    const timer = window.setInterval(refreshIfStale, 60 * 1000)
    document.addEventListener('visibilitychange', refreshIfStale)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshIfStale)
    }
  }, [])

  return null
}