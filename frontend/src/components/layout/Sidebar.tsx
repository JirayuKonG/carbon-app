import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Map, Factory, Users, Tractor,
  Layers, CloudRain, FlaskConical, ActivitySquare,
  Leaf, ChevronRight,
} from 'lucide-react'

interface NavItem {
  path: string
  label: string
  labelEn: string
  icon: React.ReactNode
  badge?: string
}

interface NavGroup {
  section: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    section: 'ภาพรวม',
    items: [
      { path: '/dashboard', label: 'แดชบอร์ด GHG', labelEn: 'GHG Dashboard', icon: <LayoutDashboard size={16} /> },
    ],
  },
  {
    section: 'ตั้งค่าระบบ',
    items: [
      { path: '/geo',   label: 'พื้นที่ในประเทศไทย', labelEn: 'Geography',     icon: <Map size={16} /> },
      { path: '/infra', label: 'โรงงาน / บริการ',    labelEn: 'Infrastructure', icon: <Factory size={16} /> },
      { path: '/users', label: 'จัดการผู้ใช้',        labelEn: 'Users',          icon: <Users size={16} /> },
    ],
  },
  {
    section: 'ข้อมูลเกษตร',
    items: [
      { path: '/farmers',          label: 'จัดการเกษตรกร',    labelEn: 'Farmers',  icon: <Tractor size={16} /> },
      { path: '/lands',            label: 'พื้นที่เพาะปลูก',   labelEn: 'Lands',    icon: <Layers size={16} /> },
      { path: '/lands/weather',    label: 'ข้อมูลสภาพอากาศ',  labelEn: 'Weather',  icon: <CloudRain size={16} />, badge: 'Import' },
    ],
  },
  {
    section: 'Carbon Footprint',
    items: [
      { path: '/emission-factors', label: 'EF / GWP / หน่วย', labelEn: 'Emission Factors', icon: <FlaskConical size={16} /> },
      { path: '/activities',       label: 'บันทึกกิจกรรม',     labelEn: 'Activities',       icon: <ActivitySquare size={16} />, badge: 'Import' },
    ],
  },
]

interface SidebarProps {
  mobile?: boolean
  onClose?: () => void
}

export function Sidebar({ mobile, onClose }: SidebarProps) {
  const location = useLocation()
  const navItems = NAV_GROUPS.flatMap((group) => group.items)
  const activePath = navItems
    .filter((item) =>
      location.pathname === item.path || location.pathname.startsWith(`${item.path}/`),
    )
    .sort((a, b) => b.path.length - a.path.length)[0]?.path

  return (
    <aside className={`sidebar flex flex-col ${mobile ? '' : 'hidden md:flex'}`}>
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center shrink-0">
            <Leaf size={16} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold text-surface-100 leading-tight">Carbon Footprint</p>
            <p className="text-[10px] text-surface-500 leading-tight">อุตสาหกรรมอ้อย</p>
          </div>
        </div>
        {/* {mobile && onClose && (
          <button onClick={onClose} className="btn-icon btn-ghost text-surface-400 hover:text-surface-200">
            <X size={16} />
          </button>
        )} */}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
        {NAV_GROUPS.map((group) => (
          <div key={group.section}>
            <p className="sidebar-section">{group.section}</p>
            <ul className="px-2 space-y-0.5">
              {group.items.map((item) => {
                const isActive = activePath === item.path
                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      onClick={onClose}
                      className={`sidebar-item ${isActive ? 'active' : ''}`}
                    >
                      <span className="shrink-0">{item.icon}</span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary-700/50 text-primary-300 border border-primary-700/40 shrink-0">
                          {item.badge}
                        </span>
                      )}
                      {isActive && <ChevronRight size={12} className="shrink-0 text-primary-400" />}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-surface-800">
        <p className="text-[10px] text-surface-600 text-center">
          Schema v1.3 · NestJS + Prisma + PostgreSQL
        </p>
      </div>
    </aside>
  )
}
