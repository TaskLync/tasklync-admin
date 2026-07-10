'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function MfaForm() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const tempToken = sessionStorage.getItem('mfa_temp_token')
      if (!tempToken) {
        setError('Your session expired. Please sign in again.')
        router.push('/auth/login')
        return
      }

      const res = await fetch('/api/admin/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, code }),
      })

      let data: any = null
      try {
        data = await res.json()
      } catch {
        throw new Error('Server error. Please try again in a moment.')
      }

      if (!res.ok) {
        setError(data?.error ?? 'Invalid code')
        return
      }
      sessionStorage.removeItem('mfa_temp_token')
      sessionStorage.setItem('admin_access_token', data.accessToken)
      router.push('/')
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
    </form>
  )
}