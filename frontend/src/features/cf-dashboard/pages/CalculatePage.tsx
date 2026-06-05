import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ActivitySquare, Calculator, CheckCircle2, CircleAlert, Clock3, Edit3, Leaf } from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { DashboardVisibilityMenu, useDashboardVisibility } from '@/components/ui/DashboardVisibilityMenu'
import {
  ACTIVITY_CAL_STATUS_NAMES,
  getActivityCalStatusBadgeClass,
  getActivityCalStatusKind,
  getActivityCalStatusLabel,
} from '@/features/activities/cal-status'
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

type ManualStatusName = 'กำลังเตรียมข้อมูล' | 'พร้อมคำนวณมาตรฐาน' | 'คำนวณแล้ว(มาตรฐาน)'
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

  const statusMut = useMutation({
    mutationFn: ({ ids, statusName }: { ids: number[]; statusName: ManualStatusName }) => (
      ids.length === 1
        ? post(`/activities/details/${ids[0]}/manual-status`, { statusName })
        : post('/activities/details/manual-status/bulk', { ids, statusName })
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
  const standardStatusEligibleIds = selectedRows.filter((row) => ['ready', 'cfpDone'].includes(getKind(row))).map((row) => row.id)
  const standardEligibleIds = selectedRows.filter((row) => getKind(row) === 'ready').map((row) => row.id)
  const cfpEligibleIds = selectedRows.filter((row) => ['standardDone', 'cfpDone'].includes(getKind(row))).map((row) => row.id)
  const importedCount = rows.filter((row) => getKind(row) === 'imported').length
  const preparingCount = rows.filter((row) => getKind(row) === 'preparing').length
  const readyCount = rows.filter((row) => getKind(row) === 'ready').length
  const standardDoneCount = rows.filter((row) => getKind(row) === 'standardDone').length
  const cfpDoneCount = rows.filter((row) => getKind(row) === 'cfpDone').length
  const errorCount = rows.filter((row) => getKind(row) === 'error').length

  const dashboardOptions = [
    { key: 'total', label: 'รายการทั้งหมด' },
    { key: 'imported', label: 'นำเข้าข้อมูลแล้ว' },
    { key: 'preparing', label: 'กำลังเตรียมข้อมูล' },
    { key: 'ready', label: 'พร้อมคำนวณมาตรฐาน' },
    { key: 'standardDone', label: 'คำนวณแล้ว(มาตรฐาน)' },
    { key: 'cfpDone', label: 'คำนวณแล้ว(มาตรฐาน,CFP)' },
    { key: 'error', label: 'คำนวณผิดพลาด' },
  ]

  const {
    visibleKeys: visibleDashboardKeys,
    visibleKeySet: visibleDashboardKeySet,
    toggleKey: toggleDashboardKey,
    reset: resetDashboardKeys,
  } = useDashboardVisibility(
    'carbon-footprint-dashboard-cards',
    dashboardOptions.map((option) => option.key),
    dashboardOptions,
  )

  const dashboardCards = [
    {
      key: 'total',
      label: 'รายการทั้งหมด',
      icon: <ActivitySquare size={14} className="text-primary-500" />,
      value: rows.length,
      valueClassName: 'stat-value',
      accentClassName: 'bg-gradient-to-r from-sky-300 via-blue-400 to-cyan-300',
      cardClassName: 'border-[#d9e7f2]',
    },
    {
      key: 'imported',
      label: 'นำเข้าข้อมูลแล้ว',
      icon: <ActivitySquare size={14} className="text-surface-500" />,
      value: importedCount,
      valueClassName: 'stat-value text-surface-700',
      accentClassName: 'bg-gradient-to-r from-slate-200 via-slate-300 to-sky-200',
      cardClassName: 'border-[#d9e7f2]',
    },
    {
      key: 'preparing',
      label: 'กำลังเตรียมข้อมูล',
      icon: <Edit3 size={14} className="text-blue-500" />,
      value: preparingCount,
      valueClassName: 'stat-value text-blue-700',
      accentClassName: 'bg-gradient-to-r from-blue-300 via-blue-400 to-indigo-300',
      cardClassName: 'border-[#d9e7f2]',
    },
    {
      key: 'ready',
      label: 'พร้อมคำนวณมาตรฐาน',
      icon: <Clock3 size={14} className="text-accent-500" />,
      value: readyCount,
      valueClassName: 'stat-value text-accent-600',
      accentClassName: 'bg-gradient-to-r from-amber-200 via-amber-400 to-orange-300',
      cardClassName: 'border-[#d9e7f2]',
    },
    {
      key: 'standardDone',
      label: 'คำนวณแล้ว(มาตรฐาน)',
      icon: <CheckCircle2 size={14} className="text-primary-500" />,
      value: standardDoneCount,
      valueClassName: 'stat-value text-primary-700',
      accentClassName: 'bg-gradient-to-r from-emerald-300 via-green-400 to-lime-300',
      cardClassName: 'border-[#d9e7f2]',
    },
    {
      key: 'cfpDone',
      label: 'คำนวณแล้ว(มาตรฐาน,CFP)',
      icon: <Leaf size={14} className="text-cyan-600" />,
      value: cfpDoneCount,
      valueClassName: 'stat-value text-cyan-700',
      accentClassName: 'bg-gradient-to-r from-cyan-300 via-teal-400 to-sky-300',
      cardClassName: 'border-[#d9e7f2]',
    },
    {
      key: 'error',
      label: 'คำนวณผิดพลาด',
      icon: <CircleAlert size={14} className="text-red-500" />,
      value: errorCount,
      valueClassName: 'stat-value text-red-700',
      accentClassName: 'bg-gradient-to-r from-rose-300 via-red-400 to-orange-300',
      cardClassName: 'border-[#f0d0cd]',
    },
  ]

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
      <div className="page active">
        <div className="card">
          <div className="page-header mb-0">
            <div>
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-surface-900"><Calculator size={20} className="text-primary-600 shrink-0" /> Carbon Footprint</h1>
              <p className="page-subtitle">หน้าจัดการสถานะก่อนคำนวณ พร้อมสั่งคำนวณมาตรฐานและ CFP แบบรายรายการหรือหลายรายการ</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
              <div className="source-badge w-full justify-start md:w-auto md:justify-end">
                <span>Workflow</span>
                <span>{filteredRows.length.toLocaleString('th-TH')} รายการพร้อมดูแล</span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button type="button" className="btn-secondary w-full justify-center sm:w-auto" onClick={selectVisibleRows}>
                  เลือกทั้งหมดที่กรอง
                </button>
                <button type="button" className="btn-ghost w-full justify-center sm:w-auto" onClick={clearSelectedRows}>
                  ล้างรายการที่เลือก
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-1">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Dashboard</h2>
              <p className="mt-1 text-xs text-surface-500">เลือกการ์ดสรุปที่ต้องการแสดงในส่วนนี้ได้</p>
            </div>
            <DashboardVisibilityMenu
              options={dashboardOptions}
              visibleKeys={visibleDashboardKeys}
              onToggle={toggleDashboardKey}
              onReset={resetDashboardKeys}
              buttonLabel="Edit Dashboard"
            />
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
            {dashboardCards
              .filter((card) => visibleDashboardKeySet.has(card.key))
              .map((card) => (
                <div key={card.key} className={`stat-card relative overflow-hidden bg-white/90 backdrop-blur-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_18px_40px_rgba(91,164,255,0.18)] border ${card.cardClassName}`}>
                  <div className={`absolute inset-x-0 top-0 h-1 ${card.accentClassName}`} />
                  <div className="flex items-center gap-2">
                    {card.icon}
                    <span className="stat-label">{card.label}</span>
                  </div>
                  <p className={card.valueClassName}>{card.value}</p>
                </div>
              ))}
          </div>
        </div>

        <div className="card min-w-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(91,164,255,0.14)]">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">ตารางรายการสำหรับคำนวณ</h2>
              <p className="mt-1 text-xs text-surface-500">เลือกตัวกรอง เลือกรายการ และใช้ปุ่มด้านล่างเพื่อขยับสถานะหรือคำนวณตามขั้นตอน</p>
            </div>
            <button type="button" className="btn-ghost btn-sm w-full justify-center sm:w-auto" onClick={clearFilters}>
              ล้างตัวกรอง
            </button>
          </div>

          <div className="mb-4 rounded-[20px] border border-[#d9e7f2] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(243,247,251,0.96))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
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

          <div className="mb-4 rounded-[20px] border border-[#d9e7f2] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(243,247,251,0.96))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Edit3 size={14} className="text-primary-600" />
                  <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-surface-600">เปลี่ยนสถานะ</h3>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  <button
                    type="button"
                    className="btn-secondary btn-sm w-full justify-center"
                    disabled={!preparingEligibleIds.length || statusMut.isPending}
                    onClick={() => statusMut.mutate({ ids: preparingEligibleIds, statusName: ACTIVITY_CAL_STATUS_NAMES.preparing })}
                  >
                    <Edit3 size={14} /> ย้ายเป็นกำลังเตรียมข้อมูล
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-sm w-full justify-center"
                    disabled={!readyEligibleIds.length || statusMut.isPending}
                    onClick={() => statusMut.mutate({ ids: readyEligibleIds, statusName: ACTIVITY_CAL_STATUS_NAMES.ready })}
                  >
                    <Clock3 size={14} /> ย้ายเป็นพร้อมคำนวณมาตรฐาน
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-sm w-full justify-center"
                    disabled={!standardStatusEligibleIds.length || statusMut.isPending}
                    onClick={() => statusMut.mutate({ ids: standardStatusEligibleIds, statusName: ACTIVITY_CAL_STATUS_NAMES.standardDone })}
                  >
                    <CheckCircle2 size={14} /> ย้ายเป็นคำนวณแล้ว(มาตรฐาน)
                  </button>
                </div>
              </div>

              <div className="border-t border-[#d9e7f2] pt-3">
                <div className="mb-2 flex items-center gap-2">
                  <Calculator size={14} className="text-primary-600" />
                  <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-surface-600">คำนวณ</h3>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:max-w-[32rem]">
                  <button
                    type="button"
                    className="btn-primary btn-sm w-full justify-center"
                    disabled={!standardEligibleIds.length || calculateMut.isPending}
                    onClick={() => calculateMut.mutate({ ids: standardEligibleIds, calcMode: 'standard' })}
                  >
                    <Calculator size={14} /> คำนวณมาตรฐาน
                  </button>
                  <button
                    type="button"
                    className="btn-primary btn-sm w-full justify-center"
                    disabled={!cfpEligibleIds.length || calculateMut.isPending}
                    onClick={() => calculateMut.mutate({ ids: cfpEligibleIds, calcMode: 'tver' })}
                  >
                    <Leaf size={14} /> คำนวณ CFP
                  </button>
                </div>
              </div>
            </div>
          </div>

          {(statusMut.isError || calculateMut.isError) && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
              {statusMut.error?.message ?? calculateMut.error?.message}
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
                      onClick={() => statusMut.mutate({ ids: [row.id], statusName: ACTIVITY_CAL_STATUS_NAMES.preparing })}
                    >
                      เตรียม
                    </button>
                  )}
                  {kind === 'preparing' && (
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => statusMut.mutate({ ids: [row.id], statusName: ACTIVITY_CAL_STATUS_NAMES.ready })}
                    >
                      พร้อมคำนวณ
                    </button>
                  )}
                  {['ready', 'cfpDone'].includes(kind) && (
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => statusMut.mutate({ ids: [row.id], statusName: ACTIVITY_CAL_STATUS_NAMES.standardDone })}
                    >
                      มาตรฐานแล้ว
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
          <div className="card min-w-0 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_18px_40px_rgba(91,164,255,0.16)]">
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

          <div className="card min-w-0 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_18px_40px_rgba(91,164,255,0.16)]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">สรุปรายการที่เลือก</h2>
            </div>
            <div className="space-y-3 text-sm text-surface-700">
              <div className="flex flex-col gap-1 rounded-xl border border-[#d9e7f2] bg-[linear-gradient(180deg,#ffffff,#f3f7fb)] px-4 py-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_24px_rgba(91,164,255,0.12)] sm:flex-row sm:items-center sm:justify-between sm:gap-3"><span>เลือกอยู่</span><strong>{selectedIds.length} รายการ</strong></div>
              <div className="flex flex-col gap-1 rounded-xl border border-[#d9e7f2] bg-[linear-gradient(180deg,#ffffff,#f3f7fb)] px-4 py-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_24px_rgba(91,164,255,0.12)] sm:flex-row sm:items-center sm:justify-between sm:gap-3"><span>ย้ายเป็นกำลังเตรียมข้อมูลได้</span><strong>{preparingEligibleIds.length} รายการ</strong></div>
              <div className="flex flex-col gap-1 rounded-xl border border-[#d9e7f2] bg-[linear-gradient(180deg,#ffffff,#f3f7fb)] px-4 py-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_24px_rgba(91,164,255,0.12)] sm:flex-row sm:items-center sm:justify-between sm:gap-3"><span>ย้ายเป็นพร้อมคำนวณมาตรฐานได้</span><strong>{readyEligibleIds.length} รายการ</strong></div>
              <div className="flex flex-col gap-1 rounded-xl border border-[#d9e7f2] bg-[linear-gradient(180deg,#ffffff,#f3f7fb)] px-4 py-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_24px_rgba(91,164,255,0.12)] sm:flex-row sm:items-center sm:justify-between sm:gap-3"><span>ย้ายเป็นคำนวณแล้ว(มาตรฐาน)ได้</span><strong>{standardStatusEligibleIds.length} รายการ</strong></div>
              <div className="flex flex-col gap-1 rounded-xl border border-[#d9e7f2] bg-[linear-gradient(180deg,#ffffff,#f3f7fb)] px-4 py-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_24px_rgba(91,164,255,0.12)] sm:flex-row sm:items-center sm:justify-between sm:gap-3"><span>คำนวณมาตรฐานได้</span><strong>{standardEligibleIds.length} รายการ</strong></div>
              <div className="flex flex-col gap-1 rounded-xl border border-[#d9e7f2] bg-[linear-gradient(180deg,#ffffff,#f3f7fb)] px-4 py-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_24px_rgba(91,164,255,0.12)] sm:flex-row sm:items-center sm:justify-between sm:gap-3"><span>คำนวณ CFP ได้</span><strong>{cfpEligibleIds.length} รายการ</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
