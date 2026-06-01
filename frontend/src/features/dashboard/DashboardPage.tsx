import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { get } from '@/lib/api'
import { LayoutDashboard, TrendingDown, Leaf, Wind, Flame } from 'lucide-react'

interface GhgSummary { label: string; co2e: number; co2: number; ch4: number; n2o: number }
interface GhgByCamp  { camp_name: string; co2e: number }
interface GhgByActivity { activity_type: string; co2e: number }

const CHART_COLORS = ['#16a34a', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4']

export function DashboardPage() {
  const [groupBy, setGroupBy] = useState<'camp' | 'activity' | 'land'>('camp')
  const [selectedCamps, setSelectedCamps] = useState<number[]>([])

  useQuery({ queryKey: ['ghg-summary'],    queryFn: () => get<GhgSummary[]>('/analytics/summary') })
  const { data: byCamp }     = useQuery({ queryKey: ['ghg-by-camp'],     queryFn: () => get<GhgByCamp[]>('/analytics/by-camp') })
  const { data: byActivity } = useQuery({ queryKey: ['ghg-by-activity'], queryFn: () => get<GhgByActivity[]>('/analytics/by-activity') })
  const { data: camps = [] }                      = useQuery({ queryKey: ['camps'],               queryFn: () => get<{ land_camp_id: number; land_camp_name: string }[]>('/lands/camps') })

  // Mock data for skeleton display when API has no data yet
  const mockByCamp: GhgByCamp[] = byCamp?.length ? byCamp : [
    { camp_name: 'แคมป์ A', co2e: 1240 }, { camp_name: 'แคมป์ B', co2e: 980 },
    { camp_name: 'แคมป์ C', co2e: 1560 }, { camp_name: 'แคมป์ D', co2e: 720 },
    { camp_name: 'แคมป์ E', co2e: 1100 },
  ]
  const mockByActivity: GhgByActivity[] = byActivity?.length ? byActivity : [
    { activity_type: 'ใส่ปุ๋ย',       co2e: 2340 },
    { activity_type: 'ฉีดยา',         co2e: 870 },
    { activity_type: 'เก็บเกี่ยว',    co2e: 1120 },
    { activity_type: 'ไถพรวน',        co2e: 560 },
    { activity_type: 'ขนส่ง',         co2e: 430 },
  ]
  const totalCo2e = mockByCamp.reduce((s, c) => s + c.co2e, 0)

  const GROUP_OPTS = [
    { key: 'camp',     label: 'ตามแคมป์' },
    { key: 'activity', label: 'ตามกิจกรรม' },
    { key: 'land',     label: 'ตามแปลง' },
  ] as const

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><LayoutDashboard size={20} className="text-primary-600" /> แดชบอร์ด GHG</h1>
          <p className="page-subtitle">สรุปการปล่อยก๊าซเรือนกระจกในระบบ Carbon Footprint</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card border-l-4 border-l-primary-500">
          <div className="flex items-center gap-2"><Leaf size={14} className="text-primary-600" /><span className="stat-label">CO₂e รวม</span></div>
          <p className="stat-value">{totalCo2e.toLocaleString()}</p>
          <p className="stat-sub">kgCO₂e</p>
        </div>
        <div className="stat-card border-l-4 border-l-blue-500">
          <div className="flex items-center gap-2"><Wind size={14} className="text-blue-500" /><span className="stat-label">CO₂</span></div>
          <p className="stat-value text-blue-700">3,210</p>
          <p className="stat-sub">kgCO₂</p>
        </div>
        <div className="stat-card border-l-4 border-l-accent-500">
          <div className="flex items-center gap-2"><Flame size={14} className="text-accent-500" /><span className="stat-label">CH₄</span></div>
          <p className="stat-value text-accent-700">142</p>
          <p className="stat-sub">kgCH₄</p>
        </div>
        <div className="stat-card border-l-4 border-l-purple-500">
          <div className="flex items-center gap-2"><TrendingDown size={14} className="text-purple-500" /><span className="stat-label">N₂O</span></div>
          <p className="stat-value text-purple-700">28</p>
          <p className="stat-sub">kgN₂O</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Bar chart — by group */}
        <div className="card xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">CO₂e ตามกลุ่ม</h2>
            <div className="flex gap-1 bg-surface-100 p-0.5 rounded-lg">
              {GROUP_OPTS.map(o => (
                <button key={o.key} onClick={() => setGroupBy(o.key)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${groupBy === o.key ? 'bg-white shadow-card text-surface-900' : 'text-surface-500'}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={groupBy === 'activity' ? mockByActivity : mockByCamp} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey={groupBy === 'activity' ? 'activity_type' : 'camp_name'} tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                formatter={(v: number) => [`${v.toLocaleString()} kgCO₂e`, 'CO₂e']}
              />
              <Bar dataKey="co2e" fill="#16a34a" radius={[4, 4, 0, 0]}>
                {(groupBy === 'activity' ? mockByActivity : mockByCamp).map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="card">
          <h2 className="text-sm font-semibold mb-4">สัดส่วนตามกิจกรรม</h2>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={mockByActivity} dataKey="co2e" nameKey="activity_type" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 10 }}>
                {mockByActivity.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => `${v.toLocaleString()} kgCO₂e`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-3">
            {mockByActivity.map((a, i) => (
              <div key={a.activity_type} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                <span className="flex-1 text-surface-600 truncate">{a.activity_type}</span>
                <span className="font-mono font-medium">{a.co2e.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Multi-camp selector */}
      {camps.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold mb-3">เปรียบเทียบแคมป์ (multi-select)</h2>
          <div className="flex gap-2 flex-wrap mb-4">
            {camps.map(c => (
              <button key={c.land_camp_id}
                onClick={() => setSelectedCamps(prev => prev.includes(c.land_camp_id) ? prev.filter(x => x !== c.land_camp_id) : [...prev, c.land_camp_id])}
                className={`btn btn-sm rounded-full ${selectedCamps.includes(c.land_camp_id) ? 'btn-primary' : 'btn-secondary'}`}>
                {c.land_camp_name}
              </button>
            ))}
          </div>
          {selectedCamps.length > 0 && (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={mockByCamp.filter((_, i) => selectedCamps.includes(i + 1))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="camp_name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="co2e" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  )
}
