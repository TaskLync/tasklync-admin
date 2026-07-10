// lib/nav-config.ts
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  ShieldCheck,
  Users,
  Wrench,
  ClipboardList,
  Wallet,
  Gavel,
  BarChart3,
  ListPlus,
  Star,
  Bell,
  Map,
  Tags,
  Settings,
} from 'lucide-react'
import type { AdminRole } from '@/lib/auth/rbac'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  allowedRoles: AdminRole[]
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    allowedRoles: ['SUPER_ADMIN', 'OPS', 'FINANCE', 'SUPPORT'],
  },
  {
    label: 'Worker Verification',
    href: '/workers/verification',
    icon: ShieldCheck,
    allowedRoles: ['SUPER_ADMIN', 'OPS'],
  },
  {
    label: 'Users',
    href: '/users',
    icon: Users,
    allowedRoles: ['SUPER_ADMIN', 'OPS', 'SUPPORT'],
  },
  {
    label: 'Workers',
    href: '/workers',
    icon: Wrench,
    allowedRoles: ['SUPER_ADMIN', 'OPS'],
  },
  {
    label: 'Bookings',
    href: '/bookings',
    icon: ClipboardList,
    allowedRoles: ['SUPER_ADMIN', 'OPS', 'SUPPORT'],
  },
  {
    label: 'Payments & Finance',
    href: '/payments',
    icon: Wallet,
    allowedRoles: ['SUPER_ADMIN', 'FINANCE'],
  },
  {
    label: 'Disputes & Refunds',
    href: '/disputes',
    icon: Gavel,
    allowedRoles: ['SUPER_ADMIN', 'OPS', 'SUPPORT'],
  },
  {
    label: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    allowedRoles: ['SUPER_ADMIN', 'OPS', 'FINANCE'],
  },
  {
    label: 'Waitlist',
    href: '/waitlist',
    icon: ListPlus,
    allowedRoles: ['SUPER_ADMIN', 'OPS'],
  },
  {
    label: 'Reviews & Ratings',
    href: '/reviews',
    icon: Star,
    allowedRoles: ['SUPER_ADMIN', 'OPS', 'SUPPORT'],
  },
  {
    label: 'Notifications',
    href: '/notifications',
    icon: Bell,
    allowedRoles: ['SUPER_ADMIN', 'OPS'],
  },
  {
    label: 'Live Map',
    href: '/map',
    icon: Map,
    allowedRoles: ['SUPER_ADMIN', 'OPS'],
  },
  {
    label: 'Categories & Pricing',
    href: '/categories',
    icon: Tags,
    allowedRoles: ['SUPER_ADMIN'],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    allowedRoles: ['SUPER_ADMIN'],
  },
]