import { Menu, Bell, Search } from 'lucide-react'

interface TopbarProps {
  onMenuClick: () => void
}

export function Topbar({ onMenuClick }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-surface-100 bg-white px-4 shadow-sm lg:px-6">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="btn-icon btn-ghost xl:hidden"
        aria-label="เปิดเมนู"
      >
        <Menu size={18} />
      </button>

      {/* Search */}
      <div className="hidden max-w-md flex-1 items-center gap-2 rounded-lg border border-surface-200 bg-surface-50 px-3 py-1.5 md:flex">
        <Search size={14} className="text-surface-400 shrink-0" />
        <input
          type="text"
          placeholder="ค้นหาเกษตรกร, แปลง, กิจกรรม..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-surface-400 text-surface-700"
        />
        <kbd className="hidden lg:inline-flex text-[10px] text-surface-400 border border-surface-200 rounded px-1.5 py-0.5 font-mono">
          ⌘K
        </kbd>
      </div>

      <div className="flex-1 md:flex-none" />

      {/* Right actions */}
      <button className="btn-icon btn-ghost relative" aria-label="การแจ้งเตือน">
        <Bell size={16} />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary-500 rounded-full" />
      </button>

      {/* User avatar placeholder */}
      <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-xs font-semibold text-white cursor-pointer hover:bg-primary-700 transition-colors">
        AD
      </div>
    </header>
  )
}
