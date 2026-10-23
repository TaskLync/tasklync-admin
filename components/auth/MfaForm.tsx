'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { safeNextPath } from '@/lib/auth/redirect'

interface VerifyResponse {
  error?: string
}

export function MfaForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = safeNextPath(params.get('next'))

  const [code, setCode] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      // The MFA challenge lives in an httpOnly cookie. Nothing to read from sessionStorage.
      const res = await fetch('/api/admin/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ code: code.trim(), remember }),
      })

      let data: VerifyResponse | null = null
      try {
        data = await res.json()
      } catch {
        throw new Error('Server error. Please try again in a moment.')
      }

      if (res.status === 401 && data?.error?.toLowerCase().includes('expired')) {
        router.replace('/auth/login?reason=expired')
        return
      }
      if (!res.ok) {
        setError(data?.error ?? 'Invalid code')
        return
      }

      router.replace(next)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-bg-surface border border-border rounded-lg p-6 w-full max-w-sm">
      <h1 className="text-lg font-semibold text-text-primary">Two Factor Verification</h1>
      <p className="text-xs text-text-secondary">
        Enter the 6 digit code from your authenticator app, or a backup code.
      </p>

      <div>
        <label htmlFor="code" className="text-xs font-medium text-gray-700 block mb-1">
          Code
        </label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={11}
          required
          autoFocus
          autoComplete="one-time-code"
          disabled={loading}
          className="h-9 w-full px-3 text-sm border border-gray-300 rounded-md font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>

      <label className="flex items-start gap-2 text-xs text-text-secondary cursor-pointer select-none">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          disabled={loading}
          className="mt-0.5"
        />
        <span>
          Remember this device for 7 days
          <span className="block text-text-muted">Don&apos;t tick this on a shared computer.</span>
        </span>
      </label>

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="cursor-pointer h-9 w-full text-sm font-medium rounded-md bg-accent text-white transition-colors duration-150 hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading && (
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin"
          />
        )}
        {loading ? 'Verifying…' : 'Verify'}
      </button>

      <button
        type="button"
        onClick={() => router.replace('/auth/login')}
        className="cursor-pointer w-full text-xs text-text-secondary hover:underline"
      >
        Back to sign in
      </button>
    </form>
  )
}