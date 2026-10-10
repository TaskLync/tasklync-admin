// components/layout/Sidebar.tsx
'use client'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronsLeft, ChevronsRight, LogOut } from 'lucide-react'
import { NAV_ITEMS } from '@/lib/nav-config'
import { useSidebarStore } from '@/lib/store/useSidebarStore'
import { useAdminSession } from '@/hooks/useAdminSession'
import { cn } from '@/lib/cn'

export function Sidebar() {
  const pathname = usePathname()
  const { collapsed, toggle } = useSidebarStore()
  const { admin, loading } = useAdminSession()

  const visibleItems = NAV_ITEMS.filter((item) =>
    admin ? item.allowedRoles.includes(admin.role) : false
  )

  // Highlight only the most specific nav item (so /workers/verification
  // doesn't also light up "Workers").
  const activeHref = NAV_ITEMS.map((i) => i.href)
    .filter((h) => (h === '/' ? pathname === '/' : pathname === h || pathname.startsWith(h + '/')))
    .sort((a, b) => b.length - a.length)[0]

  async function handleLogout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' })
    window.location.href = '/auth/login'
  }

  return (
    <aside
      className={cn(
        'flex h-screen shrink-0 flex-col border-r border-gray-200 bg-white transition-[width] duration-150',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Brand */}
      <div className="flex h-14 items-center gap-2 border-b border-gray-200 px-4">
        <div className="relative h-7 w-7 shrink-0">
          <Image
            src="/favicon.ico"
            alt="TaskLync"
            fill
            className="object-contain"
            priority
          />
        </div>
        {!collapsed && (
          <span className="truncate text-sm font-semibold text-gray-900">
            TaskLync Admin
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {loading &&
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-md bg-gray-100" />
          ))}
        {!loading &&
          visibleItems.map((item) => {
            const active = item.href === activeHref
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-150',
                  active
                    ? 'bg-[#1F6F5F]/10 font-medium text-[#1F6F5F]'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                <Icon size={16} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            )
          })}
      </nav>

      {/* Logout */}
      <button
        onClick={handleLogout}
        title={collapsed ? 'Log out' : undefined}
        className="cursor-pointer flex items-center gap-2.5 border-t border-gray-200 px-4 py-2.5 text-sm text-gray-600 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
      >
        <LogOut size={16} className="shrink-0" />
        {!collapsed && <span>Log out</span>}
      </button>

      {/* Collapse toggle */}
      <button
        onClick={toggle}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="cursor-pointer flex h-11 items-center justify-center gap-2 border-t border-gray-200 text-gray-400 transition-colors duration-150 hover:bg-gray-50 hover:text-gray-600"
      >
        {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        {!collapsed && <span className="text-xs">Collapse</span>}
      </button>
    </aside>
  )
}