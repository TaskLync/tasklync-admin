import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-lg p-8 text-center">
        <p className="text-5xl font-semibold text-[#1F6F5F]">404</p>
        <h1 className="mt-3 text-lg font-semibold text-gray-900">Page not found</h1>
        <p className="mt-2 text-sm text-gray-500">
          The page you are looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link
            href="/"
            className="inline-flex h-9 items-center rounded-md bg-[#1F6F5F] px-4 text-sm font-medium text-white hover:opacity-90"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}