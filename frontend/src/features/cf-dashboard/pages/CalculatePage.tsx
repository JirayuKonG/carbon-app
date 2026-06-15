import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ActivitySquare, ArrowRight, Calculator, CheckCircle2, ChevronDown, ChevronUp, CircleAlert, Clock3, Edit3, Leaf, LoaderCircle, X } from 'lucide-react'
import { DatabaseConnectionNotice } from '@/components/ui/DatabaseConnectionNotice'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { DashboardVisibilityMenu, useDashboardVisibility } from '@/components/ui/DashboardVisibilityMenu'
import { CarbonFootprintQueuePage } from '@/features/cf-dashboard/pages/CarbonFootprintQueuePage'
import {
  ACTIVITY_CAL_STATUS_NAMES,
  getActivityCalStatusBadgeClass,
  getActivityCalStatusKind,
  getActivityCalStatusLabel,
} from '@/features/activities/cal-status'
import { get, post } from '@/lib/api'
import { formatBangkokDate } from '@/lib/datetime'
import '../cf-dashboard.css'

interface DetailHeaderLocation {
  activities_header_id: number
  activities_header_idCode?: string
  activities_header_startDate?: string
  land_id?: number
  lands?: {
    land_code?: string
    name?: string
    land_camp_id?: number
    lands_camps?: {
      land_camp_name?: string
    }
  }
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
  units?: { unit_name?: string; unit_initial?: string }
  units_prefixs?: { unit_prefix_name?: string; unit_prefix_initial?: string; unit_prefix_value?: number }
  activities_header?: DetailHeaderLocation
}

interface HeaderType { act_header_type_id: number; act_header_type_name_th: string }
interface DetailType { act_header_detail_type_id: number; act_header_detail_type_name_th: string }
interface ResourceType { resource_used_type_id: number; resc_used_type_name: string }
interface CalStatus { log_act_detail_calStatus_id: number; log_act_detail_calStatus_name: string }

type ManualStatusName = 'กำลังเตรียมข้อมูล'

type StatusPopupState =
  | { kind: 'hidden' }
  | { kind: 'loading'; itemCount: number }
  | { kind: 'success'; itemCount: number; countdown: number }

type CalculateRow = {
  id: number
  checked: boolean
  dateLabel: string
  headerLabel: string
  activityTypeName: string
  detailTypeName: string
  resourceTypeName: string
  resourceItemName: string
  unitLabel: string
  quantityLabel: string
  totalVolumeLabel: string
  statusLabel: string
  statusRawName: string
  original: LogDetail
}

const CAMP_ONLY_LAND_LABEL = 'เบิกเข้าไร่'

function isPlaceholderLand(landCode?: string, landName?: string) {
  return landCode?.trim().toUpperCase().startsWith('AUTO-CAMP-')
    || landName?.trim().toUpperCase().startsWith('[AUTO-CAMP]')
}

function formatNumber(value?: number, digits = 0) {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toLocaleString('th-TH', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function formatQuantityValue(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '—'
  const digits = Number.isInteger(value) ? 0 : 3
  return value.toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })
}

function getDetailUnitLabel(detail: LogDetail) {
  const prefix = detail.units_prefixs?.unit_prefix_initial || detail.units_prefixs?.unit_prefix_name || ''
  const unit = detail.units?.unit_initial || detail.units?.unit_name || '—'
  return [prefix, unit].filter(Boolean).join(' ')
}

export function CfCalculatePage() {
  const qc = useQueryClient()
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [activityTypeFilter, setActivityTypeFilter] = useState('')
  const [resourceTypeFilters, setResourceTypeFilters] = useState<string[]>([])
  const [resourceTypeFilterExpanded, setResourceTypeFilterExpanded] = useState(false)
  const [landScopeFilter, setLandScopeFilter] = useState<'actual' | 'all' | 'camp-only'>('actual')
  const [statusPopup, setStatusPopup] = useState<StatusPopupState>({ kind: 'hidden' })

  const { data: details = [], isLoading, error: detailsError } = useQuery({
    queryKey: ['activity-details-calculate'],
    queryFn: () => get<LogDetail[]>('/activities/details'),
  })
  const { data: calStatuses = [], error: calStatusesError } = useQuery({
    queryKey: ['cal-statuses-calculate'],
    queryFn: () => get<CalStatus[]>('/activities/cal-statuses'),
  })
  const { data: headerTypes = [], error: headerTypesError } = useQuery({
    queryKey: ['header-types-calculate'],
    queryFn: () => get<HeaderType[]>('/activities/header-types'),
  })
  const { data: detailTypes = [], error: detailTypesError } = useQuery({
    queryKey: ['detail-types-calculate'],
    queryFn: () => get<DetailType[]>('/activities/detail-types'),
  })
  const { data: resourceTypes = [], error: resourceTypesError } = useQuery({
    queryKey: ['resource-types-calculate'],
    queryFn: () => get<ResourceType[]>('/activities/resource-types'),
  })

  const pageQueryItems = [
    { label: 'รายการสำหรับคำนวณ', error: detailsError },
    { label: 'สถานะการคำนวณ', error: calStatusesError },
    { label: 'ประเภทกิจกรรม', error: headerTypesError },
    { label: 'รายละเอียดกิจกรรม', error: detailTypesError },
    { label: 'ประเภทปัจจัย', error: resourceTypesError },
  ]

  const headerTypeMap = Object.fromEntries(headerTypes.map((item) => [item.act_header_type_id, item.act_header_type_name_th]))
  const detailTypeMap = Object.fromEntries(detailTypes.map((item) => [item.act_header_detail_type_id, item.act_header_detail_type_name_th]))
  const resourceTypeMap = Object.fromEntries(resourceTypes.map((item) => [item.resource_used_type_id, item.resc_used_type_name]))
  const selectedResourceTypeLabels = resourceTypes
    .filter((type) => resourceTypeFilters.includes(String(type.resource_used_type_id)))
    .map((type) => type.resc_used_type_name)

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
      dateLabel: formatBangkokDate(detail.log_act_detail_create_at ?? detail.activities_header?.activities_header_startDate),
      headerLabel: detail.activities_header?.activities_header_idCode ?? (detail.activities_header_id != null ? `#${detail.activities_header_id}` : '—'),
      activityTypeName: headerTypeMap[detail.act_header_type_id] ?? String(detail.act_header_type_id ?? '—'),
      detailTypeName: detailTypeMap[detail.act_header_detail_type_id ?? 0] ?? (detail.act_header_detail_type_id != null ? String(detail.act_header_detail_type_id) : '—'),
      resourceTypeName: detail.resource_used_type?.resc_used_type_name ?? resourceTypeMap[detail.resource_used_type_id] ?? '—',
      resourceItemName: getResourceItemName(detail),
      unitLabel: getDetailUnitLabel(detail),
      quantityLabel: formatQuantityValue(detail.log_act_detail_quatity),
      totalVolumeLabel: formatNumber(detail.log_act_detail_volumeAll, 3),
      statusLabel: getActivityCalStatusLabel(statusRawName, detail.log_act_detail_calStatus_id),
      statusRawName,
      original: detail,
    }
  }), [calStatuses, detailTypeMap, details, headerTypeMap, resourceTypeMap, selectedIds])

  const filteredRows = rows.filter((row) =>
    (!statusFilter || row.original.log_act_detail_calStatus_id === Number(statusFilter))
    && (!activityTypeFilter || row.original.act_header_type_id === Number(activityTypeFilter))
    && (!resourceTypeFilters.length || resourceTypeFilters.includes(String(row.original.resource_used_type_id)))
    && (
      landScopeFilter === 'all'
        ? true
        : (() => {
            const land = row.original.activities_header?.lands
            const isCampOnly = isPlaceholderLand(land?.land_code, land?.name)
            return landScopeFilter === 'camp-only' ? isCampOnly : !isCampOnly
          })()
    ),
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
    setResourceTypeFilters([])
    setResourceTypeFilterExpanded(false)
    setLandScopeFilter('actual')
  }

  const toggleResourceTypeFilter = (value: string, checked: boolean) => {
    setResourceTypeFilters((prev) => (
      checked
        ? Array.from(new Set([...prev, value]))
        : prev.filter((item) => item !== value)
    ))
  }

  useEffect(() => {
    if (statusPopup.kind !== 'success') return undefined

    const timer = window.setTimeout(() => {
      setStatusPopup((prev) => {
        if (prev.kind !== 'success') return prev
        if (prev.countdown <= 1) return { kind: 'hidden' }
        return { ...prev, countdown: prev.countdown - 1 }
      })
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [statusPopup])

  const statusMut = useMutation({
    mutationFn: ({ ids, statusName }: { ids: number[]; statusName: ManualStatusName }) => (
      ids.length === 1
        ? post(`/activities/details/${ids[0]}/manual-status`, { statusName }, { timeout: 2 * 60_000 })
        : post('/activities/details/manual-status/bulk', { ids, statusName }, { timeout: 10 * 60_000 })
    ),
    onMutate: ({ ids }) => {
      setStatusPopup({ kind: 'loading', itemCount: ids.length })
    },
    onSuccess: async (_data, variables) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['activity-details-calculate'] }),
        qc.invalidateQueries({ queryKey: ['activity-details'] }),
        qc.invalidateQueries({ queryKey: ['carbon-process-queue'] }),
      ])
      setSelectedIds([])
      setStatusPopup({
        kind: 'success',
        itemCount: variables.ids.length,
        countdown: 4,
      })
    },
    onError: () => {
      setStatusPopup({ kind: 'hidden' })
    },
  })

  const submitPreparingStatus = (ids: number[]) => {
    if (!ids.length || statusMut.isPending) return
    statusMut.mutate({ ids, statusName: ACTIVITY_CAL_STATUS_NAMES.preparing })
  }

  const getKind = (row: CalculateRow) => getActivityCalStatusKind(row.statusRawName, row.original.log_act_detail_calStatus_id)
  const selectedRows = filteredRows.filter((row) => selectedIds.includes(row.id))
  const preparingEligibleIds = selectedRows.filter((row) => getKind(row) === 'imported').map((row) => row.id)
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
    { key: 'cfpDone', label: 'คำนวณแล้ว(มาตรฐาน,C-credit)' },
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
      label: 'คำนวณแล้ว(มาตรฐาน,C-credit)',
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
    { key: 'unitLabel', header: 'หน่วยปัจจุบัน', sortable: true },
    { key: 'quantityLabel', header: 'จำนวน', sortable: true },
    { key: 'totalVolumeLabel', header: 'ปริมาณรวมปัจจุบัน', sortable: true, render: (row) => <span className="font-mono">{row.totalVolumeLabel}</span> },
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
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-surface-900"><Calculator size={20} className="text-primary-600 shrink-0" /> เตรียมข้อมูล Carbon</h1>
              <p className="page-subtitle">เลือกข้อมูลที่นำเข้าแล้วเพื่อส่งเข้าสู่คิวเตรียมข้อมูล Carbon Footprint</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
              <div className="source-badge w-full justify-start md:w-auto md:justify-end">
                <span>Preparation</span>
                <span>{filteredRows.length.toLocaleString('th-TH')} รายการในตาราง</span>
              </div>
            </div>
          </div>
        </div>

        <DatabaseConnectionNotice
          items={pageQueryItems}
          className="mt-4"
          onRetry={() => { void qc.refetchQueries({ type: 'active' }) }}
        />

        <div className="mb-1">
          <div className="mb-5 space-y-4">
            <div className="card min-w-0 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_18px_40px_rgba(91,164,255,0.16)]">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">ลำดับการทำงาน</h2>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-surface-700">
                <div className="flex min-w-[220px] items-center gap-2 rounded-xl border border-[#d9e7f2] bg-[linear-gradient(180deg,#ffffff,#f3f7fb)] px-3 py-2">
                  <span className="font-medium">1.</span>
                  <span>นำเข้าข้อมูล แล้วระบบจะตั้งเป็น <span className="font-medium">นำเข้าข้อมูลแล้ว</span></span>
                </div>
                <ArrowRight size={16} className="text-surface-400" />
                <div className="flex min-w-[220px] items-center gap-2 rounded-xl border border-[#d9e7f2] bg-[linear-gradient(180deg,#ffffff,#f3f7fb)] px-3 py-2">
                  <span className="font-medium">2.</span>
                  <span>เลือกรายการที่ต้องเตรียม แล้วกดส่งเป็น <span className="font-medium">กำลังเตรียมข้อมูล</span></span>
                </div>
                <ArrowRight size={16} className="text-surface-400" />
                <div className="flex min-w-[220px] items-center gap-2 rounded-xl border border-[#d9e7f2] bg-[linear-gradient(180deg,#ffffff,#f3f7fb)] px-3 py-2">
                  <span className="font-medium">3.</span>
                  <span>ระบบสร้างรายการใน <span className="font-medium">carbon_process_queue</span> อัตโนมัติแบบไม่ซ้ำ</span>
                </div>
                <ArrowRight size={16} className="text-surface-400" />
                <div className="flex min-w-[220px] items-center gap-2 rounded-xl border border-[#d9e7f2] bg-[linear-gradient(180deg,#ffffff,#f3f7fb)] px-3 py-2">
                  <span className="font-medium">4.</span>
                  <span>ไปหน้า <span className="font-medium">Carbon Footprint</span> เพื่อปรับหน่วย ปริมาณ และข้อมูลตรวจดิน/SOC</span>
                </div>
              </div>
            </div>
            <div className="card min-w-0 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_18px_40px_rgba(91,164,255,0.16)]">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">สรุปรายการที่เลือก</h2>
              </div>
              <div className="grid grid-cols-1 gap-2 text-xs text-surface-700 sm:grid-cols-3">
                <div className="flex flex-col gap-1 rounded-xl border border-[#d9e7f2] bg-[linear-gradient(180deg,#ffffff,#f3f7fb)] px-3 py-2">
                  <span>เลือกอยู่</span>
                  <strong className="text-sm">{selectedIds.length} รายการ</strong>
                </div>
                <div className="flex flex-col gap-1 rounded-xl border border-[#d9e7f2] bg-[linear-gradient(180deg,#ffffff,#f3f7fb)] px-3 py-2">
                  <span>ส่งเข้า queue ได้</span>
                  <strong className="text-sm">{preparingEligibleIds.length} รายการ</strong>
                </div>
                <div className="flex flex-col gap-1 rounded-xl border border-[#d9e7f2] bg-[linear-gradient(180deg,#ffffff,#f3f7fb)] px-3 py-2">
                  <span>ที่เลือกแต่ไม่ใช่สถานะนำเข้า</span>
                  <strong className="text-sm">{Math.max(selectedIds.length - preparingEligibleIds.length, 0)} รายการ</strong>
                </div>
              </div>
            </div>
          </div>

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
              <h2 className="text-sm font-semibold">ตารางรายการเตรียมข้อมูล</h2>
              <p className="mt-1 text-xs text-surface-500">เลือกเฉพาะรายการสถานะนำเข้าข้อมูลแล้วเพื่อส่งเข้า queue สำหรับเตรียมหน่วยและปริมาณ โดยค่าเริ่มต้นจะซ่อนรายการ {CAMP_ONLY_LAND_LABEL}</p>
            </div>
            <button type="button" className="btn-ghost btn-sm w-full justify-center sm:w-auto" onClick={clearFilters}>
              ล้างตัวกรอง
            </button>
          </div>

          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button type="button" className="btn-secondary w-full justify-center sm:w-auto" onClick={selectVisibleRows}>
              เลือกทั้งหมดที่กรอง
            </button>
            <button type="button" className="btn-ghost w-full justify-center sm:w-auto" onClick={clearSelectedRows}>
              ล้างรายการที่เลือก
            </button>
          </div>

          <div className="mb-4 rounded-[20px] border border-[#d9e7f2] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(243,247,251,0.96))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
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
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="label mb-0">ประเภทปัจจัย</label>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-[#d9e7f2] bg-white/80 px-2.5 py-1 text-xs text-surface-600 shadow-sm transition hover:border-[#c5dbeb] hover:text-surface-800"
                    onClick={() => setResourceTypeFilterExpanded((prev) => !prev)}
                  >
                    {resourceTypeFilterExpanded ? 'ย่อ' : 'ขยาย'}
                    {resourceTypeFilterExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
                <div className="rounded-xl border border-[#d9e7f2] bg-white/85 p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2 text-xs text-surface-500">
                    <span>{resourceTypeFilters.length ? `เลือกแล้ว ${resourceTypeFilters.length} รายการ` : 'ยังไม่ได้เลือก = ทั้งหมด'}</span>
                    <button
                      type="button"
                      className="text-primary-700 transition hover:text-primary-800 disabled:text-surface-300"
                      disabled={!resourceTypeFilters.length}
                      onClick={() => setResourceTypeFilters([])}
                    >
                      ล้าง
                    </button>
                  </div>
                  {!!selectedResourceTypeLabels.length && (
                    <p className="mt-2 line-clamp-2 text-xs text-surface-600">
                      {selectedResourceTypeLabels.join(', ')}
                    </p>
                  )}
                  {resourceTypeFilterExpanded && (
                    <div className="mt-3 max-h-40 space-y-2 overflow-y-auto border-t border-[#e5eef5] pt-3 pr-1">
                      {resourceTypes.map((type) => {
                        const value = String(type.resource_used_type_id)
                        const checked = resourceTypeFilters.includes(value)

                        return (
                          <label key={type.resource_used_type_id} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-[#f3f7fb]">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => toggleResourceTypeFilter(value, event.target.checked)}
                              className="mt-0.5"
                            />
                            <span>{type.resc_used_type_name}</span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="label">ขอบเขตพื้นที่</label>
                <select className="select" value={landScopeFilter} onChange={(event) => setLandScopeFilter(event.target.value as 'actual' | 'all' | 'camp-only')}>
                  <option value="actual">เฉพาะแปลงจริง</option>
                  <option value="all">ทั้งหมด</option>
                  <option value="camp-only">{CAMP_ONLY_LAND_LABEL}</option>
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
                  <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-surface-600">ส่งเข้า Queue</h3>
                </div>
                <div className="grid grid-cols-1 gap-2 xl:max-w-[24rem]">
                  <button
                    type="button"
                    className="btn-secondary btn-sm w-full justify-center"
                    disabled={!preparingEligibleIds.length || statusMut.isPending}
                    onClick={() => submitPreparingStatus(preparingEligibleIds)}
                  >
                    <Edit3 size={14} /> ย้ายเป็นกำลังเตรียมข้อมูล
                  </button>
                </div>
              </div>
            </div>
          </div>

          {statusMut.isError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
              {statusMut.error?.message}
            </div>
          )}

          <DataTable
            data={filteredRows}
            columns={columns}
            isLoading={isLoading}
            rowKey={(row) => row.id}
            searchPlaceholder="ค้นหาหัวข้อกิจกรรม รายการปัจจัย หรือรายละเอียด..."
            emptyMessage="ไม่พบรายการสำหรับเตรียมข้อมูล"
            actions={(row) => {
              const kind = getKind(row)

              return (
                <div className="flex justify-end gap-1">
                  {kind === 'imported' && (
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => submitPreparingStatus([row.id])}
                    >
                      เข้า Queue
                    </button>
                  )}
                  {kind !== 'imported' && <span className="text-xs text-surface-400">ส่งแล้ว</span>}
                </div>
              )
            }}
          />
        </div>

        <section className="mt-6 rounded-[28px] border border-[#d8c08d] bg-[linear-gradient(180deg,rgba(255,251,242,0.98),rgba(247,240,223,0.94))] p-4 shadow-[0_20px_48px_rgba(120,94,38,0.10)]">
          <div className="mb-4 flex flex-col gap-3 border-b border-[#e6d7b5] pb-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d8c08d] bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7a6331]">
                <Clock3 size={13} />
                คิวเตรียมข้อมูลทั้งหมด
              </div>
              <h2 className="mt-3 text-lg font-semibold text-[#46371a]">Preparation Queue Workspace</h2>
              <p className="mt-1 text-sm text-[#6d5a31]">
                ส่วนนี้ใช้จัดการรายการที่ถูกส่งเข้า queue แล้ว เพื่อเตรียมหน่วย ปรับปริมาณ และเปลี่ยนสถานะก่อนเข้าสู่การคำนวณจริง
              </p>
            </div>
            <div className="rounded-2xl border border-[#e6d7b5] bg-white/70 px-4 py-3 text-sm text-[#6d5a31] shadow-sm">
              แยกจากบล็อกด้านบนเพื่อให้มองออกทันทีว่าเป็นพื้นที่ทำงานของ queue
            </div>
          </div>

          <CarbonFootprintQueuePage mode="preparation" embedded />
        </section>

        {statusPopup.kind !== 'hidden' && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
            <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-[#d9e7f2] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,248,253,0.98))] p-6 shadow-[0_28px_80px_rgba(35,49,66,0.24)] animate-slide-up">
              {statusPopup.kind === 'loading' ? (
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(91,164,255,0.22),rgba(91,164,255,0.08),transparent_72%)]">
                    <LoaderCircle size={40} className="animate-spin text-primary-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-surface-900">กำลังเปลี่ยนสถานะข้อมูล</h3>
                  <p className="mt-2 text-sm text-surface-600">
                    ระบบกำลังย้าย {statusPopup.itemCount.toLocaleString('th-TH')} รายการ จาก
                    {' '}<span className="font-medium">นำเข้าข้อมูลแล้ว</span>{' '}เป็น{' '}
                    <span className="font-medium">กำลังเตรียมข้อมูล</span>
                  </p>
                  <div className="mt-4 flex items-center gap-2 rounded-full border border-[#d9e7f2] bg-white/85 px-4 py-2 text-xs text-surface-500 shadow-sm">
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                    <span className="ml-1">กรุณารอสักครู่</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  <button
                    type="button"
                    className="absolute right-3 top-3 rounded-full p-2 text-surface-400 transition hover:bg-white/70 hover:text-surface-700"
                    onClick={() => setStatusPopup({ kind: 'hidden' })}
                  >
                    <X size={16} />
                  </button>
                  <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(78,143,106,0.24),rgba(78,143,106,0.08),transparent_72%)]">
                    <CheckCircle2 size={40} className="text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-surface-900">เปลี่ยนสถานะสำเร็จแล้ว</h3>
                  <p className="mt-2 text-sm text-surface-600">
                    ย้ายข้อมูล {statusPopup.itemCount.toLocaleString('th-TH')} รายการ ไปที่
                    {' '}<span className="font-medium">กำลังเตรียมข้อมูล</span>{' '}เรียบร้อยแล้ว
                  </p>
                  <div className="mt-4 rounded-2xl border border-[#d9e7f2] bg-white/90 px-4 py-3 shadow-sm">
                    <span className="text-xs text-surface-500">หน้าต่างนี้จะปิดอัตโนมัติใน </span>
                    <span className="countdown text-sm">{statusPopup.countdown}</span>
                    <span className="text-xs text-surface-500"> วินาที</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
