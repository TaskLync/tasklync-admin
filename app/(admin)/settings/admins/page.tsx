'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { fetcher } from '@/lib/swr-fetcher'

interface AdminRow {
  id: string
  email: string
  fullName: string
  role: string
  isActive: boolean
  mfaEnabled: boolean
  lastLoginAt: string | null
}

const ROLES = ['SUPER_ADMIN', 'OPS', 'FINANCE', 'SUPPORT']

async function call(method: 'POST' | 'PATCH', url: string, body?: object) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Action failed')
  return json
}

export default function AdminUsersPage() {
  const { data, mutate, isLoading } = useSWR<AdminRow[]>('/api/admin/admins', fetcher)
  const [form, setForm] = useState({ email: '', fullName: '', role: 'OPS', password: '' })
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true)
    try {
      await fn()
      toast.success(ok)
      await mutate()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-lg font-semibold text-gray-900">Admin users</h1>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              {['Name', 'Email', 'Role', 'MFA', 'Last login', 'Status', ''].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">Loading…</td></tr>
            )}
            {(data ?? []).map((a) => (
              <tr key={a.id} className="border-t border-gray-100">
                <td className="px-3 py-2">{a.fullName}</td>
                <td className="px-3 py-2">{a.email}</td>
                <td className="px-3 py-2">
                  <select
                    value={a.role}
                    disabled={busy}
                    onChange={(e) =>
                      run(() => call('PATCH', `/api/admin/admins/${a.id}`, { role: e.target.value }), 'Role updated')
                    }
                    className="rounded border border-gray-300 px-2 py-1 text-xs"
                  >
                    {ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">{a.mfaEnabled ? 'On' : 'Not set'}</td>
                <td className="px-3 py-2 text-xs text-gray-500">
                  {a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('en-GB') : 'Never'}
                </td>
                <td className="px-3 py-2">{a.isActive ? 'Active' : 'Deactivated'}</td>
                <td className="space-x-2 px-3 py-2 text-xs">
                  <button
                    disabled={busy}
                    className="cursor-pointer text-[#1F6F5F] hover:underline"
                    onClick={() =>
                      run(
                        () => call('PATCH', `/api/admin/admins/${a.id}`, { isActive: !a.isActive }),
                        a.isActive ? 'Deactivated' : 'Activated'
                      )
                    }
                  >
                    {a.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    disabled={busy}
                    className="cursor-pointer text-gray-600 hover:underline"
                    onClick={() => run(() => call('POST', `/api/admin/admins/${a.id}/logout-all`), 'Signed out everywhere')}
                  >
                    Sign out everywhere
                  </button>
                  <button
                    disabled={busy}
                    className="cursor-pointer text-red-600 hover:underline"
                    onClick={() => {
                      if (confirm(`Reset MFA for ${a.email}? They must enrol again.`)) {
                        run(() => call('POST', `/api/admin/admins/${a.id}/reset-mfa`), 'MFA reset')
                      }
                    }}
                  >
                    Reset MFA
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Create admin</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input placeholder="Full name" value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input placeholder="Email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
          <input type="password" placeholder="Temporary password (12+ chars, upper, lower, number)" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <button
          disabled={busy}
          onClick={() =>
            run(async () => {
              await call('POST', '/api/admin/admins', form)
              setForm({ email: '', fullName: '', role: 'OPS', password: '' })
            }, 'Admin created. Share the temporary password privately; MFA setup is forced at first login.')
          }
          className="mt-4 cursor-pointer rounded-md bg-[#1F6F5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#195c4f] disabled:opacity-50"
        >
          Create admin
        </button>
      </div>
    </div>
  )
}