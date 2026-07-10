export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[--bg-page]">
      <div className="w-full max-w-sm bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        {children}
      </div>
    </div>
  )
}