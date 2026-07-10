// app/(admin)/layout.tsx
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F8FA]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}