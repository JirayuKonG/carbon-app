import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { MobileNav } from './MobileNav'

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Drawer overlay for tablet/mobile widths */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 xl:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-40 w-[var(--sidebar-width)] transform bg-surface-900 shadow-card-lg transition-transform duration-200 xl:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} mobile />
      </div>

      {/* Main area */}
      <div className="main-content flex flex-col min-h-screen min-w-0">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 w-full min-w-0 max-w-screen-2xl mx-auto animate-fade p-4 md:p-6 xl:p-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  )
}
