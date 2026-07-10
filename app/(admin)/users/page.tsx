// app/(admin)/users/page.tsx
import UsersTableSection from '@/components/users/UsersTableSection'
import { UserKpiGrid } from '@/components/users/UserKpiGrid'

export const metadata = { title: 'Users | Tasklync Admin' }

export default function UsersPage() {
  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Users</h1>
        <p className="text-sm text-gray-500">Search, filter, and manage every user on the platform.</p>
      </div>
      <div className="mb-4">
        <UserKpiGrid />
      </div>
      <UsersTableSection />
    </div>
  )
}