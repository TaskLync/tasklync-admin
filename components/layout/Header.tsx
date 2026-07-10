// components/layout/Header.tsx
'use client'

import { Bell } from 'lucide-react'
import { Breadcrumb } from './Breadcrumb'
import { useAdminSession } from '@/hooks/useAdminSession'

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  OPS: 'Ops',
  FINANCE: 'Finance',
  SUPPORT: 'Support',
}

export function Header() {
  const { admin } = useAdminSession()

  const initials = admin?.fullName
    ? admin.fullName
        .split(' ')
        .map((p: string) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '..'

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
      <Breadcrumb />
      <div className="flex items-center gap-3">
        <button
          title="Notifications"
          className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors duration-150 hover:bg-gray-50"
        >
          <Bell size={16} />
        </button>
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-700">
            {initials}
          </span>
          {admin && (
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-medium text-gray-800">
                {admin.fullName}
              </span>
              <span className="block text-xs text-gray-400">
                {ROLE_LABEL[admin.role] ?? admin.role}
              </span>
            </span>
          )}
        </div>
      </div>
    </header>
  )
}