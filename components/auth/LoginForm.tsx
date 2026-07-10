'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      let data: any = null
      try {
        data = await res.json()
      } catch {
        throw new Error('Server error. Please try again in a moment.')
      }

      if (!res.ok) {
        setError(data?.error ?? 'Something went wrong')
        return
      }
      if (data.requiresMFA) {
        sessionStorage.setItem('mfa_temp_token', data.tempToken)
        router.push('/auth/mfa')
        return
      }
      sessionStorage.setItem('admin_access_token', data.accessToken)
      router.push(data.mfaSetupRequired ? '/auth/mfa-setup' : '/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-bg-surface border border-border rounded-lg p-6 w-full max-w-sm">
      <h1 className="text-lg font-semibold text-text-primary">Admin Sign In</h1>

      <div>
        <label htmlFor="email" className="text-xs font-medium text-gray-700 block mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          disabled={loading}
          className="h-9 w-full px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>

      <div>
        <label htmlFor="password" className="text-xs font-medium text-gray-700 block mb-1">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          disabled={loading}
          className="h-9 w-full px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60 disabled:cursor-not-allowed"
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
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}