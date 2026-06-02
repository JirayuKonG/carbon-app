import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Map, Factory, Users, Tractor,
  Layers, CloudRain, FlaskConical, ActivitySquare, Settings2,
  Leaf, ChevronDown, ChevronRight, X, BarChart3, Sprout, MapPin, FileText,
} from 'lucide-react'

interface NavItem {
  label: string
  labelEn: string
  icon: React.ReactNode
  path?: string
  badge?: string
  children?: NavItem[]
}

interface NavGroup {
  section: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    section: 'Carbon Analytics',
    items: [
      {
        path: '/overview',
        label: 'ภาพรวม Carbon',
        labelEn: 'Overview',
        icon: <BarChart3 size={16} />,
        children: [
          { path: '/overview', label: 'ข้อมูลสรุป', labelEn: 'Summary', icon: <BarChart3 size={14} /> },
          { path: '/process', label: 'กระบวนการเพาะปลูก', labelEn: 'Process', icon: <Sprout size={14} /> },
          { path: '/report', label: 'รายงาน Premium T-VER', labelEn: 'Report', icon: <FileText size={14} /> },
        ],
      },
      { path: '/spatial', label: 'แผนที่พื้นที่', labelEn: 'Spatial', icon: <MapPin size={16} /> },
    ],
  },
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
      {
        label: 'บันทึกกิจกรรม',
        labelEn: 'Activities',
        icon: <ActivitySquare size={16} />,
        badge: 'Import',
        children: [
          { path: '/activities/logs', label: 'รายการบันทึกกิจกรรม', labelEn: 'Activity Logs', icon: <ActivitySquare size={14} /> },
          { path: '/activities/manage', label: 'จัดการกิจกรรม', labelEn: 'Manage Activities', icon: <Settings2 size={14} /> },
        ],
      },
    ],
  },
]

interface SidebarProps {
  mobile?: boolean
  onClose?: () => void
}

export function Sidebar({ mobile, onClose }: SidebarProps) {
  const location = useLocation()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  const navItems = NAV_GROUPS.flatMap((group) => group.items.flatMap((item) => [item, ...(item.children ?? [])]))
  const activePath = navItems
    .filter((item): item is NavItem & { path: string } => Boolean(item.path))
    .filter((item) =>
      location.pathname === item.path || location.pathname.startsWith(`${item.path}/`),
    )
    .sort((a, b) => b.path.length - a.path.length)[0]?.path

  useEffect(() => {
    const nextOpenGroups = Object.fromEntries(
      NAV_GROUPS.flatMap((group) =>
        group.items
          .filter((item) => item.path === activePath || item.children?.some((child) => child.path === activePath))
          .map((item) => [item.label, true]),
      ),
    )

    setOpenGroups((prev) => ({ ...prev, ...nextOpenGroups }))
  }, [activePath])

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <aside className={mobile ? 'flex h-full flex-col bg-surface-900 text-surface-100' : 'sidebar hidden xl:flex flex-col'}>
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
        {mobile && onClose && (
          <button onClick={onClose} className="btn-icon btn-ghost text-surface-400 hover:text-surface-200">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
        {NAV_GROUPS.map((group) => (
          <div key={group.section}>
            <p className="sidebar-section">{group.section}</p>
            <ul className="px-2 space-y-0.5">
              {group.items.map((item) => {
                const childActive = item.children?.some((child) => child.path === activePath) ?? false
                const isActive = item.path ? activePath === item.path || childActive : childActive
                const isOpen = openGroups[item.label] ?? childActive

                if (item.children?.length) {
                  return (
                    <li key={item.label}>
                      <button
                        type="button"
                        className={`sidebar-item w-full ${isActive ? 'active' : ''}`}
                        onClick={() => toggleGroup(item.label)}
                      >
                        <span className="shrink-0">{item.icon}</span>
                        <span className="flex-1 truncate text-left">{item.label}</span>
                        {item.badge && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary-700/50 text-primary-300 border border-primary-700/40 shrink-0">
                            {item.badge}
                          </span>
                        )}
                        <ChevronDown size={12} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180 text-primary-300' : 'text-surface-500'}`} />
                      </button>

                      {isOpen && (
                        <ul className="sidebar-submenu">
                          {item.children.map((child) => {
                            const childIsActive = activePath === child.path
                            return (
                              <li key={child.path}>
                                <NavLink
                                  to={child.path ?? '/'}
                                  onClick={onClose}
                                  className={`sidebar-subitem ${childIsActive ? 'active' : ''}`}
                                >
                                  <span className="shrink-0">{child.icon}</span>
                                  <span className="flex-1 truncate">{child.label}</span>
                                  {childIsActive && <ChevronRight size={12} className="shrink-0 text-primary-300" />}
                                </NavLink>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </li>
                  )
                }

                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path ?? '/'}
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
