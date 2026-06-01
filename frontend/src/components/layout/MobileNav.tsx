import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Layers, ActivitySquare, FlaskConical, Menu } from 'lucide-react'

const MOBILE_NAV = [
  { path: '/dashboard',        icon: <LayoutDashboard size={20} />, label: 'หน้าหลัก' },
  { path: '/lands',            icon: <Layers size={20} />,          label: 'แปลง' },
  { path: '/activities/logs',  icon: <ActivitySquare size={20} />,  label: 'กิจกรรม' },
  { path: '/emission-factors', icon: <FlaskConical size={20} />,    label: 'EF/GWP' },
  { path: '/geo',              icon: <Menu size={20} />,            label: 'ตั้งค่า' },
]

export function MobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-surface-200 flex md:hidden shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
      {MOBILE_NAV.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors duration-150 ${
              isActive ? 'text-primary-600' : 'text-surface-500'
            }`
          }
        >
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
