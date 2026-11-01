import Link from 'next/link'
import PricingSettings from '@/components/settings/PricingSettings'

export default function SettingsPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Platform configuration. Super Admin only.</p>
      </div>
      <PricingSettings />
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Admin users</h2>
        <p className="mt-1 text-xs text-gray-500">Create admins, change roles, deactivate, reset MFA.</p>
        <Link href="/settings/admins" className="mt-3 inline-block text-sm text-[#1F6F5F] hover:underline">
          Manage admin users
        </Link>
      </div>
    </div>
  )
}