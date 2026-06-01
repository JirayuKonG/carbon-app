import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DataTable, Column } from '@/components/ui/DataTable'
import { get } from '@/lib/api'
import { FlaskConical } from 'lucide-react'

interface Fertilizer {
  act_fertilizer_id: number
  act_fertilizer_name?: string | null
}

interface Chemical {
  act_chemiscal_id: number
  act_chemiscal_name?: string | null
}

interface Equipment {
  act_equipment_id: number
  act_equipment_name?: string | null
}

type TabKey = 'fertilizers' | 'chemicals' | 'equipments'

export function ActivityResourcesPage() {
  const [tab, setTab] = useState<TabKey>('fertilizers')

  const { data: fertilizers = [], isLoading: fertilizersLoading, error: fertilizersError } = useQuery({
    queryKey: ['activity-resource-fertilizers'],
    queryFn: () => get<Fertilizer[]>('/activities/fertilizers'),
  })

  const { data: chemicals = [], isLoading: chemicalsLoading, error: chemicalsError } = useQuery({
    queryKey: ['activity-resource-chemicals'],
    queryFn: () => get<Chemical[]>('/activities/chemicals'),
  })

  const { data: equipments = [], isLoading: equipmentsLoading, error: equipmentsError } = useQuery({
    queryKey: ['activity-resource-equipments'],
    queryFn: () => get<Equipment[]>('/activities/equipments'),
  })

  const queryError = [fertilizersError, chemicalsError, equipmentsError]
    .find((error): error is Error => error instanceof Error)

  const fertilizerCols: Column<Fertilizer>[] = [
    { key: 'act_fertilizer_id', header: 'ID', width: '80px', sortable: true },
    {
      key: 'act_fertilizer_name',
      header: 'ชื่อปุ๋ย',
      sortable: true,
      render: (row) => row.act_fertilizer_name?.trim() || '-',
    },
  ]

  const chemicalCols: Column<Chemical>[] = [
    { key: 'act_chemiscal_id', header: 'ID', width: '80px', sortable: true },
    {
      key: 'act_chemiscal_name',
      header: 'ชื่อสารเคมี',
      sortable: true,
      render: (row) => row.act_chemiscal_name?.trim() || '-',
    },
  ]

  const equipmentCols: Column<Equipment>[] = [
    { key: 'act_equipment_id', header: 'ID', width: '80px', sortable: true },
    {
      key: 'act_equipment_name',
      header: 'ชื่ออุปกรณ์',
      sortable: true,
      render: (row) => row.act_equipment_name?.trim() || '-',
    },
  ]

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'fertilizers', label: 'ปุ๋ย', count: fertilizers.length },
    { key: 'chemicals', label: 'เคมี', count: chemicals.length },
    { key: 'equipments', label: 'อุปกรณ์', count: equipments.length },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <FlaskConical size={20} className="text-primary-600" /> ปุ๋ย / เคมี / อุปกรณ์
          </h1>
          <p className="page-subtitle">รายการอ้างอิงแบบอ่านอย่างเดียวสำหรับการบันทึกกิจกรรมและการนำเข้าข้อมูล CSV</p>
        </div>
      </div>

      {queryError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-medium">ไม่สามารถโหลดข้อมูลรายการอ้างอิงได้</p>
          <p className="mt-1">{queryError.message}</p>
        </div>
      )}

      <div className="flex gap-1 mb-5 bg-surface-100 p-1 rounded-xl w-fit flex-wrap">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === item.key ? 'bg-white shadow-card text-surface-900' : 'text-surface-500 hover:text-surface-700'
            }`}
          >
            {item.label}
            <span className="text-[10px] bg-surface-200 text-surface-500 px-1.5 rounded-full">{item.count}</span>
          </button>
        ))}
      </div>

      <div className="card">
        {tab === 'fertilizers' && (
          <div>
            <h2 className="text-sm font-semibold text-surface-800 mb-4">รายการปุ๋ย ({fertilizers.length})</h2>
            <DataTable
              data={fertilizers}
              columns={fertilizerCols}
              isLoading={fertilizersLoading}
              rowKey={(row) => row.act_fertilizer_id}
              defaultPageSize={10}
              searchPlaceholder="ค้นหาชื่อปุ๋ย..."
              emptyMessage="ไม่พบข้อมูลปุ๋ย"
            />
          </div>
        )}

        {tab === 'chemicals' && (
          <div>
            <h2 className="text-sm font-semibold text-surface-800 mb-4">รายการสารเคมี ({chemicals.length})</h2>
            <DataTable
              data={chemicals}
              columns={chemicalCols}
              isLoading={chemicalsLoading}
              rowKey={(row) => row.act_chemiscal_id}
              defaultPageSize={10}
              searchPlaceholder="ค้นหาชื่อสารเคมี..."
              emptyMessage="ไม่พบข้อมูลสารเคมี"
            />
          </div>
        )}

        {tab === 'equipments' && (
          <div>
            <h2 className="text-sm font-semibold text-surface-800 mb-4">รายการอุปกรณ์ ({equipments.length})</h2>
            <DataTable
              data={equipments}
              columns={equipmentCols}
              isLoading={equipmentsLoading}
              rowKey={(row) => row.act_equipment_id}
              defaultPageSize={10}
              searchPlaceholder="ค้นหาชื่ออุปกรณ์..."
              emptyMessage="ไม่พบข้อมูลอุปกรณ์"
            />
          </div>
        )}
      </div>
    </div>
  )
}
