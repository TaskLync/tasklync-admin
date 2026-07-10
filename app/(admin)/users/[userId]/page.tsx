'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useUserDetail } from '@/hooks/useUsers'
import UserProfileHeader from '@/components/users/UserProfileHeader'
import UserBookingHistory from '@/components/users/UserBookingHistory'
import UserReviewHistory from '@/components/users/UserReviewHistory'
import UserReportedIssues from '@/components/users/UserReportedIssues'
import UserAddressList from '@/components/users/UserAddressList'
import UserBlockedWorkers from '@/components/users/UserBlockedWorkers'
import UserAdminActions from '@/components/users/UserAdminActions'

export default function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)
  const { user, isLoading, error, mutate } = useUserDetail(userId)

  return (
    <div className="px-6 py-5">
      <Link
        href="/users"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} /> Back to Users
      </Link>

      <UserProfileHeader user={user} isLoading={isLoading} error={error} />

      {error && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white py-10 text-center text-sm text-gray-500">
          Couldn't load this user.{' '}
          <button onClick={() => mutate()} className="text-[--accent] hover:underline">
            Retry
          </button>
        </div>
      )}

      {user && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <UserBookingHistory userId={user.id} />
            <UserReviewHistory userId={user.id} />
            <UserReportedIssues userId={user.id} />
          </div>
          <div className="flex flex-col gap-4">
            <UserAdminActions user={user} onChanged={() => mutate()} />
            <UserAddressList userId={user.id} />
            <UserBlockedWorkers userId={user.id} />
          </div>
        </div>
      )}
    </div>
  )
}