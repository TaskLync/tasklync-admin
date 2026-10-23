'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Check } from 'lucide-react'
import { installFetchInterceptor } from '@/lib/auth-fetch'

// The setup page lives outside (admin)/layout, so install the silent-refresh interceptor here too.
installFetchInterceptor()

interface SetupResponse {
  error?: string
  qrCodeDataUrl?: string
  secret?: string
  backupCodes?: string[]
}

export function MfaSetupForm() {
  const router = useRouter()
  const [step, setStep] = useState<'loading' | 'scan' | 'confirmed' | 'setup-error'>('loading')
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadSetup() {
      try {
        const res = await fetch('/api/admin/auth/mfa/setup', {
          method: 'POST',
          credentials: 'same-origin',
        })

        if (res.status === 401) {
          router.replace('/auth/login?reason=expired')
          return
        }

        let data: SetupResponse | null = null
        try {
          data = await res.json()
        } catch {
          throw new Error('Server error. Please refresh and try again.')
        }

        if (res.status === 409) {
          router.replace('/') // already enrolled
          return
        }
        if (!res.ok) {
          throw new Error(data?.error ?? 'Could not start MFA setup.')
        }

        if (cancelled) return
        setQrCodeDataUrl(data?.qrCodeDataUrl ?? '')
        setSecret(data?.secret ?? '')
        setStep('scan')
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Network error. Please try again.')
        setStep('setup-error')
      }
    }

    loadSetup()
    return () => {
      cancelled = true
    }
  }, [router])

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setConfirming(true)
    try {
      const res = await fetch('/api/admin/auth/mfa/setup-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ code }),
      })

      let data: SetupResponse | null = null
      try {
        data = await res.json()
      } catch {
        throw new Error('Server error. Please try again.')
      }

      if (!res.ok) {
        setError(data?.error ?? 'Incorrect code')
        return
      }
      setBackupCodes(data?.backupCodes ?? [])
      setStep('confirmed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please try again.')
    } finally {
      setConfirming(false)
    }
  }

  async function handleCopyBackupCodes() {
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy automatically. Please select and copy manually.')
    }
  }

  if (step === 'loading') {
    return (
      <div className="space-y-2 bg-bg-surface border border-border rounded-lg p-6 w-full max-w-sm text-center">
        <span
          aria-hidden="true"
          className="inline-block h-4 w-4 rounded-full border-2 border-gray-300 border-t-accent animate-spin"
        />
        <p className="text-sm text-text-secondary">Setting up two factor authentication…</p>
      </div>
    )
  }

  if (step === 'setup-error') {
    return (
      <div className="space-y-4 bg-bg-surface border border-border rounded-lg p-6 w-full max-w-sm">
        <h1 className="text-lg font-semibold text-text-primary">Couldn&apos;t Start Setup</h1>
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="h-9 w-full text-sm font-medium rounded-md bg-accent text-white transition-colors duration-150 hover:bg-accent-hover"
        >
          Try again
        </button>
      </div>
    )
  }

  if (step === 'confirmed') {
    return (
      <div className="space-y-4 bg-bg-surface border border-border rounded-lg p-6 w-full max-w-sm">
        <h1 className="text-lg font-semibold text-text-primary">Save Your Backup Codes</h1>
        <p className="text-xs text-text-secondary">
          Each code works once, if you lose access to your authenticator app. Store these somewhere safe, they won&apos;t be shown again.
        </p>
        <div className="relative bg-gray-50 border border-gray-200 rounded-md p-3 pr-10 font-mono text-sm space-y-1">
          {backupCodes.map((c) => (
            <div key={c}>{c}</div>
          ))}
          <button
            type="button"
            onClick={handleCopyBackupCodes}
            title={copied ? 'Copied!' : 'Copy all codes'}
            className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition-colors duration-150"
          >
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          </button>
        </div>

        {copied && <p className="text-xs text-success cursor-pointer">Copied to clipboard.</p>}

        <button
          onClick={() => {
            router.replace('/')
            router.refresh()
          }}
          className="cursor-pointer h-9 w-full text-sm font-medium rounded-md bg-accent text-white transition-colors duration-150 hover:bg-accent-hover"
        >
          Saved these, Continue to Dashboard
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleConfirm} className="space-y-4 bg-bg-surface border border-border rounded-lg p-6 w-full max-w-sm">
      <h1 className="text-lg font-semibold text-text-primary">Set Up Two Factor Authentication</h1>
      <p className="text-xs text-text-secondary">Scan this with Google Authenticator or a similar app.</p>

      {qrCodeDataUrl && <img src={qrCodeDataUrl} alt="MFA QR code" className="mx-auto" width={180} height={180} />}

      <p className="text-xs text-text-muted text-center">
        Can&apos;t scan? Enter manually: <span className="font-mono">{secret}</span>
      </p>

      <div>
        <label htmlFor="mfa-setup-code" className="text-xs font-medium text-gray-700 block mb-1">
          Enter the 6 digit code to confirm
        </label>
        <input
          id="mfa-setup-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
          inputMode="numeric"
          required
          autoFocus
          disabled={confirming}
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
        disabled={confirming}
        className="h-9 w-full text-sm font-medium rounded-md bg-accent text-white transition-colors duration-150 hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {confirming && (
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin"
          />
        )}
        {confirming ? 'Confirming…' : 'Confirm & Enable'}
      </button>
    </form>
  )
}