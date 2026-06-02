import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ActivitySquare, Calculator, CheckCircle2, CircleAlert, Clock3, Edit3, Leaf } from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { getActivityCalStatusBadgeClass, getActivityCalStatusKind, getActivityCalStatusLabel } from '@/features/activities/cal-status'
import { get, post } from '@/lib/api'
import { formatBangkokDateTime } from '@/lib/datetime'
import '../cf-dashboard.css'

interface DetailHeaderLocation {
  activities_header_id: number
  activities_header_idCode?: string
  activities_header_startDate?: string
}

interface LogDetail {
  log_act_detail_id: number
  activities_header_id?: number
  act_header_type_id: number
  act_header_detail_type_id?: number
  act_equipment_id?: number
  act_fertilizer_id?: number
  act_chemiscal_id?: number
  resource_used_type_id: number
  unit_id?: number
  log_act_detail_quatity?: number
  log_act_detail_volumePerUnit?: number
  log_act_detail_volumeAll?: number
  log_act_detail_areawork?: number
  log_act_detail_calStatus_id: number
  log_act_detail_create_at?: string
  activities_fertilizers?: { act_fertilizer_name?: string }
  activities_equipments?: { act_equipment_name?: string }
  activities_chemiscals?: { act_chemiscal_name?: string }
  resource_used_type?: { resc_used_type_name?: string }
  log_act_detail_calStatus?: { log_act_detail_calStatus_name?: string }
  activities_header?: DetailHeaderLocation
}

interface HeaderType { act_header_type_id: number; act_header_type_name_th: string }
interface DetailType { act_header_detail_type_id: number; act_header_detail_type_name_th: string }
interface ResourceType { resource_used_type_id: number; resc_used_type_name: string }
interface CalStatus { log_act_detail_calStatus_id: number; log_act_detail_calStatus_name: string }

type WorkflowStatusName = 'กำลังเตรียมข้อมูล' | 'พร้อมคำนวณมาตรฐาน'
type CalcMode = 'standard' | 'tver'

type CalculateRow = {
  id: number
  checked: boolean
  dateLabel: string
  headerLabel: string
  activityTypeName: string
  detailTypeName: string
  resourceTypeName: string
  resourceItemName: string
  quantityLabel: string
  totalVolumeLabel: string
  statusLabel: string
  statusRawName: string
  original: LogDetail
}

function formatNumber(value?: number, digits = 0) {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toLocaleString('th-TH', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function CfCalculatePage() {
  const qc = useQueryClient()
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [activityTypeFilter, setActivityTypeFilter] = useState('')
  const [resourceTypeFilter, setResourceTypeFilter] = useState('')

  const { data: details = [], isLoading } = useQuery({
    queryKey: ['activity-details-calculate'],
    queryFn: () => get<LogDetail[]>('/activities/details'),
  })
  const { data: calStatuses = [] } = useQuery({
    queryKey: ['cal-statuses-calculate'],
    queryFn: () => get<CalStatus[]>('/activities/cal-statuses'),
  })
  const { data: headerTypes = [] } = useQuery({
    queryKey: ['header-types-calculate'],
    queryFn: () => get<HeaderType[]>('/activities/header-types'),
  })
  const { data: detailTypes = [] } = useQuery({
    queryKey: ['detail-types-calculate'],
    queryFn: () => get<DetailType[]>('/activities/detail-types'),
  })
  const { data: resourceTypes = [] } = useQuery({
    queryKey: ['resource-types-calculate'],
    queryFn: () => get<ResourceType[]>('/activities/resource-types'),
  })

  const headerTypeMap = Object.fromEntries(headerTypes.map((item) => [item.act_header_type_id, item.act_header_type_name_th]))
  const detailTypeMap = Object.fromEntries(detailTypes.map((item) => [item.act_header_detail_type_id, item.act_header_detail_type_name_th]))
  const resourceTypeMap = Object.fromEntries(resourceTypes.map((item) => [item.resource_used_type_id, item.resc_used_type_name]))

  const getStatusRawName = (detail: LogDetail) =>
    detail.log_act_detail_calStatus?.log_act_detail_calStatus_name
    ?? calStatuses.find((status) => status.log_act_detail_calStatus_id === detail.log_act_detail_calStatus_id)?.log_act_detail_calStatus_name
    ?? ''

  const getResourceItemName = (detail: LogDetail) =>
    detail.activities_fertilizers?.act_fertilizer_name
    ?? detail.activities_equipments?.act_equipment_name
    ?? detail.activities_chemiscals?.act_chemiscal_name
    ?? '—'

  const rows = useMemo<CalculateRow[]>(() => details.map((detail) => {
    const statusRawName = getStatusRawName(detail)
    return {
      id: detail.log_act_detail_id,
      checked: selectedIds.includes(detail.log_act_detail_id),
      dateLabel: formatBangkokDateTime(detail.log_act_detail_create_at ?? detail.activities_header?.activities_header_startDate),
      headerLabel: detail.activities_header?.activities_header_idCode ?? (detail.activities_header_id != null ? `#${detail.activities_header_id}` : '—'),
      activityTypeName: headerTypeMap[detail.act_header_type_id] ?? String(detail.act_header_type_id ?? '—'),
      detailTypeName: detailTypeMap[detail.act_header_detail_type_id ?? 0] ?? (detail.act_header_detail_type_id != null ? String(detail.act_header_detail_type_id) : '—'),
      resourceTypeName: detail.resource_used_type?.resc_used_type_name ?? resourceTypeMap[detail.resource_used_type_id] ?? '—',
      resourceItemName: getResourceItemName(detail),
      quantityLabel: formatNumber(detail.log_act_detail_quatity),
      totalVolumeLabel: formatNumber(detail.log_act_detail_volumeAll, 3),
      statusLabel: getActivityCalStatusLabel(statusRawName, detail.log_act_detail_calStatus_id),
      statusRawName,
      original: detail,
    }
  }), [calStatuses, detailTypeMap, details, headerTypeMap, resourceTypeMap, selectedIds])

  const filteredRows = rows.filter((row) =>
    (!statusFilter || row.original.log_act_detail_calStatus_id === Number(statusFilter))
    && (!activityTypeFilter || row.original.act_header_type_id === Number(activityTypeFilter))
    && (!resourceTypeFilter || row.original.resource_used_type_id === Number(resourceTypeFilter)),
  )

  const toggleSelected = (id: number, checked: boolean) => {
    setSelectedIds((prev) => (
      checked
        ? Array.from(new Set([...prev, id]))
        : prev.filter((item) => item !== id)
    ))
  }

  const selectVisibleRows = () => {
    setSelectedIds(Array.from(new Set([...selectedIds, ...filteredRows.map((row) => row.id)])))
  }

  const clearSelectedRows = () => setSelectedIds([])
  const clearFilters = () => {
    setStatusFilter('')
    setActivityTypeFilter('')
    setResourceTypeFilter('')
  }

  const workflowMut = useMutation({
    mutationFn: ({ ids, statusName }: { ids: number[]; statusName: WorkflowStatusName }) => (
      ids.length === 1
        ? post(`/activities/details/${ids[0]}/workflow-status`, { statusName })
        : post('/activities/details/workflow-status/bulk', { ids, statusName })
    ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['activity-details-calculate'] })
      void qc.invalidateQueries({ queryKey: ['activity-details'] })
      setSelectedIds([])
    },
  })

  const calculateMut = useMutation({
    mutationFn: ({ ids, calcMode }: { ids: number[]; calcMode: CalcMode }) => (
      ids.length === 1
        ? post(`/activities/details/${ids[0]}/calculate`, { calcMode })
        : post('/activities/details/calculate/bulk', { ids, calcMode })
    ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['activity-details-calculate'] })
      void qc.invalidateQueries({ queryKey: ['activity-details'] })
      setSelectedIds([])
    },
  })

  const getKind = (row: CalculateRow) => getActivityCalStatusKind(row.statusRawName, row.original.log_act_detail_calStatus_id)
  const selectedRows = filteredRows.filter((row) => selectedIds.includes(row.id))
  const preparingEligibleIds = selectedRows.filter((row) => ['imported', 'ready', 'standardDone', 'cfpDone', 'error'].includes(getKind(row))).map((row) => row.id)
  const readyEligibleIds = selectedRows.filter((row) => getKind(row) === 'preparing').map((row) => row.id)
  const standardEligibleIds = selectedRows.filter((row) => getKind(row) === 'ready').map((row) => row.id)
  const cfpEligibleIds = selectedRows.filter((row) => ['standardDone', 'cfpDone'].includes(getKind(row))).map((row) => row.id)
  const importedCount = rows.filter((row) => getKind(row) === 'imported').length
  const preparingCount = rows.filter((row) => getKind(row) === 'preparing').length
  const readyCount = rows.filter((row) => getKind(row) === 'ready').length
  const standardDoneCount = rows.filter((row) => getKind(row) === 'standardDone').length
  const cfpDoneCount = rows.filter((row) => getKind(row) === 'cfpDone').length
  const errorCount = rows.filter((row) => getKind(row) === 'error').length

  const columns: Column<CalculateRow>[] = [
    {
      key: 'checked',
      header: 'เลือก',
      width: '70px',
      render: (row) => (
        <input
          type="checkbox"
          checked={row.checked}
          onChange={(event) => toggleSelected(row.id, event.target.checked)}
        />
      ),
    },
    { key: 'dateLabel', header: 'วันที่ปฏิบัติ', sortable: true },
    { key: 'headerLabel', header: 'หัวข้อกิจกรรม', sortable: true },
    { key: 'activityTypeName', header: 'กิจกรรม', sortable: true },
    { key: 'detailTypeName', header: 'รายละเอียด', sortable: true },
    { key: 'resourceTypeName', header: 'ประเภทปัจจัย', sortable: true },
    { key: 'resourceItemName', header: 'รายการปัจจัย', sortable: true },
    { key: 'quantityLabel', header: 'จำนวน', sortable: true },
    { key: 'totalVolumeLabel', header: 'ปริมาณรวม', sortable: true, render: (row) => <span className="font-mono">{row.totalVolumeLabel}</span> },
    {
      key: 'statusLabel',
      header: 'สถานะ',
      sortable: true,
      render: (row) => <span className={getActivityCalStatusBadgeClass(row.statusRawName, row.original.log_act_detail_calStatus_id)}>{row.statusLabel}</span>,
    },
  ]

  return (
    <div className="cf-dash">
      <div className="page active relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 overflow-hidden">
          <div className="absolute -left-16 top-4 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(123,199,255,0.42)_0%,rgba(123,199,255,0)_72%)] blur-xl" />
          <div className="absolute right-8 top-0 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(114,214,201,0.34)_0%,rgba(114,214,201,0)_72%)] blur-xl" />
          <div className="absolute left-1/3 top-20 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(183,156,255,0.26)_0%,rgba(183,156,255,0)_72%)] blur-xl" />
        </div>

        <div className="relative rounded-[28px] border border-[#d9e7f2] bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(240,248,255,0.92))] px-6 py-6 shadow-[0_10px_35px_rgba(91,164,255,0.08)] backdrop-blur-sm">
          <div className="page-title">
            <div>
              <p className="eyebrow">07 · Calculate</p>
              <h1 className="flex items-center gap-2"><Calculator size={20} className="text-primary-600" /> คำนวณ Carbon Footprint</h1>
              <p className="muted mt-2 max-w-3xl">หน้าจัดการสถานะก่อนคำนวณ พร้อมสั่งคำนวณมาตรฐานและ CFP แบบรายรายการหรือหลายรายการ</p>
            </div>
            <div className="source-badge">
              <span>Workflow</span>
              <span>{filteredRows.length.toLocaleString('th-TH')} รายการพร้อมดูแล</span>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={selectVisibleRows}>
              เลือกทั้งหมดที่กรอง
            </button>
            <button type="button" className="btn-ghost" onClick={clearSelectedRows}>
              ล้างรายการที่เลือก
            </button>
          </div>
        </div>

        <div className="mb-1 grid grid-cols-2 gap-4 md:grid-cols-6">
          <div className="stat-card relative overflow-hidden border border-[#d9e7f2] bg-white/90 backdrop-blur-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_18px_40px_rgba(91,164,255,0.18)]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-300 via-blue-400 to-cyan-300" />
            <div className="flex items-center gap-2"><ActivitySquare size={14} className="text-primary-500" /><span className="stat-label">รายการทั้งหมด</span></div>
            <p className="stat-value">{rows.length}</p>
          </div>
          <div className="stat-card relative overflow-hidden border border-[#d9e7f2] bg-white/90 backdrop-blur-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_18px_40px_rgba(91,164,255,0.18)]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-200 via-slate-300 to-sky-200" />
            <div className="flex items-center gap-2"><ActivitySquare size={14} className="text-surface-500" /><span className="stat-label">นำเข้าข้อมูลแล้ว</span></div>
            <p className="stat-value text-surface-700">{importedCount}</p>
          </div>
          <div className="stat-card relative overflow-hidden border border-[#d9e7f2] bg-white/90 backdrop-blur-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_18px_40px_rgba(91,164,255,0.18)]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-300 via-blue-400 to-indigo-300" />
            <div className="flex items-center gap-2"><Edit3 size={14} className="text-blue-500" /><span className="stat-label">กำลังเตรียมข้อมูล</span></div>
            <p className="stat-value text-blue-700">{preparingCount}</p>
          </div>
          <div className="stat-card relative overflow-hidden border border-[#d9e7f2] bg-white/90 backdrop-blur-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_18px_40px_rgba(91,164,255,0.18)]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-200 via-amber-400 to-orange-300" />
            <div className="flex items-center gap-2"><Clock3 size={14} className="text-accent-500" /><span className="stat-label">พร้อมคำนวณมาตรฐาน</span></div>
            <p className="stat-value text-accent-600">{readyCount}</p>
          </div>
          <div className="stat-card relative overflow-hidden border border-[#d9e7f2] bg-white/90 backdrop-blur-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_18px_40px_rgba(91,164,255,0.18)]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-300 via-green-400 to-lime-300" />
            <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-primary-500" /><span className="stat-label">คำนวณแล้ว(มาตรฐาน)</span></div>
            <p className="stat-value text-primary-700">{standardDoneCount}</p>
          </div>
          <div className="stat-card relative overflow-hidden border border-[#d9e7f2] bg-white/90 backdrop-blur-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_18px_40px_rgba(91,164,255,0.18)]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-teal-400 to-sky-300" />
            <div className="flex items-center gap-2"><Leaf size={14} className="text-cyan-600" /><span className="stat-label">คำนวณแล้ว(มาตรฐาน,CFP)</span></div>
            <p className="stat-value text-cyan-700">{cfpDoneCount}</p>
          </div>
          <div className="stat-card relative overflow-hidden border border-[#f0d0cd] bg-white/90 backdrop-blur-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_18px_40px_rgba(186,9,0,0.14)]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-300 via-red-400 to-orange-300" />
            <div className="flex items-center gap-2"><CircleAlert size={14} className="text-red-500" /><span className="stat-label">คำนวณผิดพลาด</span></div>
            <p className="stat-value text-red-700">{errorCount}</p>
          </div>
        </div>

        <div className="card transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(91,164,255,0.14)]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">ตารางรายการสำหรับคำนวณ</h2>
              <p className="mt-1 text-xs text-surface-500">เลือกตัวกรอง เลือกรายการ และใช้ปุ่มด้านล่างเพื่อขยับสถานะหรือคำนวณตามขั้นตอน</p>
            </div>
            <button type="button" className="btn-ghost btn-sm" onClick={clearFilters}>
              ล้างตัวกรอง
            </button>
          </div>

          <div className="mb-4 rounded-[20px] border border-[#d9e7f2] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(243,247,251,0.96))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <label className="label">สถานะ</label>
                <select className="select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="">ทั้งหมด</option>
                  {calStatuses.map((status) => (
                    <option key={status.log_act_detail_calStatus_id} value={status.log_act_detail_calStatus_id}>
                      {status.log_act_detail_calStatus_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">ประเภทกิจกรรม</label>
                <select className="select" value={activityTypeFilter} onChange={(event) => setActivityTypeFilter(event.target.value)}>
                  <option value="">ทั้งหมด</option>
                  {headerTypes.map((type) => (
                    <option key={type.act_header_type_id} value={type.act_header_type_id}>
                      {type.act_header_type_name_th}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">ประเภทปัจจัย</label>
                <select className="select" value={resourceTypeFilter} onChange={(event) => setResourceTypeFilter(event.target.value)}>
                  <option value="">ทั้งหมด</option>
                  {resourceTypes.map((type) => (
                    <option key={type.resource_used_type_id} value={type.resource_used_type_id}>
                      {type.resc_used_type_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">จำนวนที่แสดง</label>
                <div className="rounded-xl border border-[#d9e7f2] bg-white/80 px-3 py-2 text-sm text-surface-700 shadow-sm">
                  {filteredRows.length.toLocaleString('th-TH')} รายการ
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={!preparingEligibleIds.length || workflowMut.isPending}
              onClick={() => workflowMut.mutate({ ids: preparingEligibleIds, statusName: 'กำลังเตรียมข้อมูล' })}
            >
              <Edit3 size={14} /> ย้ายเป็นกำลังเตรียมข้อมูล
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={!readyEligibleIds.length || workflowMut.isPending}
              onClick={() => workflowMut.mutate({ ids: readyEligibleIds, statusName: 'พร้อมคำนวณมาตรฐาน' })}
            >
              <Clock3 size={14} /> ย้ายเป็นพร้อมคำนวณมาตรฐาน
            </button>
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={!standardEligibleIds.length || calculateMut.isPending}
              onClick={() => calculateMut.mutate({ ids: standardEligibleIds, calcMode: 'standard' })}
            >
              <Calculator size={14} /> คำนวณมาตรฐาน
            </button>
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={!cfpEligibleIds.length || calculateMut.isPending}
              onClick={() => calculateMut.mutate({ ids: cfpEligibleIds, calcMode: 'tver' })}
            >
              <Leaf size={14} /> คำนวณ CFP
            </button>
          </div>

          {(workflowMut.isError || calculateMut.isError) && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
              {workflowMut.error?.message ?? calculateMut.error?.message}
            </div>
          )}

          <DataTable
            data={filteredRows}
            columns={columns}
            isLoading={isLoading}
            rowKey={(row) => row.id}
            searchPlaceholder="ค้นหาหัวข้อกิจกรรม รายการปัจจัย หรือรายละเอียด..."
            emptyMessage="ไม่พบรายการสำหรับการคำนวณ"
            actions={(row) => {
              const kind = getKind(row)

              return (
                <div className="flex justify-end gap-1">
                  {['imported', 'ready', 'standardDone', 'cfpDone', 'error'].includes(kind) && (
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => workflowMut.mutate({ ids: [row.id], statusName: 'กำลังเตรียมข้อมูล' })}
                    >
                      เตรียม
                    </button>
                  )}
                  {kind === 'preparing' && (
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => workflowMut.mutate({ ids: [row.id], statusName: 'พร้อมคำนวณมาตรฐาน' })}
                    >
                      พร้อมคำนวณ
                    </button>
                  )}
                  {kind === 'ready' && (
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => calculateMut.mutate({ ids: [row.id], calcMode: 'standard' })}
                    >
                      มาตรฐาน
                    </button>
                  )}
                  {['standardDone', 'cfpDone'].includes(kind) && (
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => calculateMut.mutate({ ids: [row.id], calcMode: 'tver' })}
                    >
                      CFP
                    </button>
                  )}
                </div>
              )
            }}
          />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="card transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_18px_40px_rgba(91,164,255,0.16)]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">ลำดับการทำงาน</h2>
            </div>
            <div className="space-y-3 text-sm text-surface-700">
              <div className="rounded-xl border border-[#d9e7f2] bg-[linear-gradient(180deg,#ffffff,#f3f7fb)] px-4 py-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_24px_rgba(91,164,255,0.12)]"><span className="font-medium">1.</span> นำเข้าข้อมูล แล้วระบบจะตั้งเป็น <span className="font-medium">นำเข้าข้อมูลแล้ว</span></div>
              <div className="rounded-xl border border-[#d9e7f2] bg-[linear-gradient(180deg,#ffffff,#f3f7fb)] px-4 py-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_24px_rgba(91,164,255,0.12)]"><span className="font-medium">2.</span> ตรวจสอบและปรับข้อมูลก่อนคำนวณเป็น <span className="font-medium">กำลังเตรียมข้อมูล</span></div>
              <div className="rounded-xl border border-[#d9e7f2] bg-[linear-gradient(180deg,#ffffff,#f3f7fb)] px-4 py-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_24px_rgba(91,164,255,0.12)]"><span className="font-medium">3.</span> ยืนยันความพร้อมก่อนคำนวณเป็น <span className="font-medium">พร้อมคำนวณมาตรฐาน</span></div>
              <div className="rounded-xl border border-[#d9e7f2] bg-[linear-gradient(180deg,#ffffff,#f3f7fb)] px-4 py-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_24px_rgba(91,164,255,0.12)]"><span className="font-medium">4.</span> คำนวณมาตรฐาน แล้วได้สถานะ <span className="font-medium">คำนวณแล้ว(มาตรฐาน)</span></div>
              <div className="rounded-xl border border-[#d9e7f2] bg-[linear-gradient(180deg,#ffffff,#f3f7fb)] px-4 py-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_24px_rgba(91,164,255,0.12)]"><span className="font-medium">5.</span> คำนวณ CFP ต่อเมื่อจำเป็น แล้วได้สถานะ <span className="font-medium">คำนวณแล้ว(มาตรฐาน,CFP)</span></div>
            </div>
          </div>

          <div className="card transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_18px_40px_rgba(91,164,255,0.16)]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">สรุปรายการที่เลือก</h2>
            </div>
            <div className="space-y-3 text-sm text-surface-700">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[#d9e7f2] bg-[linear-gradient(180deg,#ffffff,#f3f7fb)] px-4 py-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_24px_rgba(91,164,255,0.12)]"><span>เลือกอยู่</span><strong>{selectedIds.length} รายการ</strong></div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[#d9e7f2] bg-[linear-gradient(180deg,#ffffff,#f3f7fb)] px-4 py-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_24px_rgba(91,164,255,0.12)]"><span>ย้ายเป็นกำลังเตรียมข้อมูลได้</span><strong>{preparingEligibleIds.length} รายการ</strong></div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[#d9e7f2] bg-[linear-gradient(180deg,#ffffff,#f3f7fb)] px-4 py-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_24px_rgba(91,164,255,0.12)]"><span>ย้ายเป็นพร้อมคำนวณมาตรฐานได้</span><strong>{readyEligibleIds.length} รายการ</strong></div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[#d9e7f2] bg-[linear-gradient(180deg,#ffffff,#f3f7fb)] px-4 py-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_24px_rgba(91,164,255,0.12)]"><span>คำนวณมาตรฐานได้</span><strong>{standardEligibleIds.length} รายการ</strong></div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[#d9e7f2] bg-[linear-gradient(180deg,#ffffff,#f3f7fb)] px-4 py-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_24px_rgba(91,164,255,0.12)]"><span>คำนวณ CFP ได้</span><strong>{cfpEligibleIds.length} รายการ</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
