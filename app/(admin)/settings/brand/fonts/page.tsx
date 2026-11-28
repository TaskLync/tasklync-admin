import FontLibrary from '@/components/fonts/FontLibrary'

export const metadata = { title: 'Font Library | Tasklync Admin' }

export default function FontLibraryPage() {
  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Settings · Brand &amp; Typography</p>
        <h1 className="text-lg font-semibold text-gray-900">Font Library</h1>
        <p className="text-sm text-gray-500">
          Fonts available to promotional banners in the customer app. Upload a family, activate it, then pick it in a banner&apos;s
          Design &amp; typography settings. No app update needed.
        </p>
      </div>
      <FontLibrary />
    </div>
  )
}
