import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ActivitySquare, Calculator, CheckCircle2, CircleAlert, Clock3, Code2, Edit3, Leaf, LoaderCircle, Wand2, X } from 'lucide-react'
import { DatabaseConnectionNotice } from '@/components/ui/DatabaseConnectionNotice'
import { DataTable, type Column } from '@/components/ui/DataTable'
import {
  ACTIVITY_CAL_STATUS_NAMES,
  getActivityCalStatusBadgeClass,
  getActivityCalStatusKind,
  getActivityCalStatusLabel,
} from '@/features/activities/cal-status'
import { get, post, put } from '@/lib/api'
import { formatBangkokDate, formatBangkokDateTime } from '@/lib/datetime'
import '../cf-dashboard.css'

type QueuePageMode = 'preparation' | 'footprint'

interface Unit {
  unit_id?: number
  unit_name?: string
  unit_initial?: string
}

interface UnitPrefix {
  unit_prefix_id?: number
  unit_prefix_name?: string
  unit_prefix_initial?: string
  unit_prefix_value?: number
}

interface HeaderType {
  act_header_type_id: number
  act_header_type_name_th: string
}

interface DetailType {
  act_header_detail_type_id: number
  act_header_detail_type_name_th: string
}

interface QueueLogDetail {
  log_act_detail_id: number
  activities_header_id?: number
  act_header_type_id?: number
  act_header_detail_type_id?: number
  act_equipment_id?: number
  act_fertilizer_id?: number
  act_chemiscal_id?: number
  act_resourceOther_id?: number
  resource_used_type_id?: number
  unit_prefix_id?: number
  unit_id?: number
  log_act_detail_quatity?: number
  log_act_detail_volumePerUnit?: number
  log_act_detail_volumeAll?: number
  log_act_detail_areawork?: number
  log_act_detail_calStatus_id?: number
  log_act_detail_create_at?: string
  activities_fertilizers?: { act_fertilizer_name?: string }
  activities_equipments?: { act_equipment_name?: string }
  activities_chemiscals?: { act_chemiscal_name?: string }
  activities_resourceOther?: { act_resourceOther_name?: string }
  resource_used_type?: { resc_used_type_name?: string }
  log_act_detail_calStatus?: { log_act_detail_calStatus_name?: string }
  units?: { unit_name?: string; unit_initial?: string }
  units_prefixs?: { unit_prefix_name?: string; unit_prefix_initial?: string; unit_prefix_value?: number }
  activities_header?: {
    activities_header_id: number
    activities_header_idCode?: string
    activities_header_startDate?: string
    land_id?: number
    lands?: {
      land_code?: string
      name?: string
      land_camp_id?: number
      lands_camps?: { land_camp_name?: string }
    }
  }
}

interface CarbonProcessQueueItem {
  carbon_process_queue_id: number
  log_act_detail_id?: number
  log_act_detail_calStatus_id?: number
  land_id?: number
  land_camp_id?: number
  carbon_process_queue_dateWork?: string
  N?: number
  carbon_process_queue_info?: string
  carbon_process_queue_resultValue?: number | string
  unit_prefix_id_resultValue?: number
  unit_id_resultValue?: number
  carbon_process_queue_updated_at?: string
  lands?: { land_code?: string; name?: string }
  lands_camps?: { land_camp_name?: string }
  units?: { unit_name?: string; unit_initial?: string }
  units_prefixs?: { unit_prefix_name?: string; unit_prefix_initial?: string; unit_prefix_value?: number }
  log_act_detail_calStatus?: { log_act_detail_calStatus_name?: string }
  log_activities_detail?: QueueLogDetail
}

type CarbonPreparationInfo = {
  sourceUnitId?: number
  sourceUnitPrefixId?: number
  sourceVolumePerUnit?: number
  sourceVolumeAll?: number
  preparedUnitId?: number
  preparedUnitPrefixId?: number
  preparedVolumePerUnit?: number
  preparedVolumeAll?: number
  conversionFactor?: number
  fertilizerBagWeightKg?: number
  fertilizerPrepareType?: string
  soilSampleDate?: string
  soilN?: number
  soilSocBaseline?: number
  soilSocProject?: number
  note?: string
  preparedAt?: string
}

type PreparationForm = {
  preparedUnitId: string
  preparedUnitName: string
  preparedUnitInitial: string
  preparedUnitPrefixId: string
  preparedVolumeAll: string
  preparedVolumePerUnit: string
  conversionFactor: string
  fertilizerBagWeightKg: string
  fertilizerPrepareType: string
  soilSampleDate: string
  soilN: string
  soilSocBaseline: string
  soilSocProject: string
  note: string
}

type QueueRow = {
  id: number
  checked?: boolean
  detailId: number
  dateLabel: string
  headerLabel: string
  activityTypeName: string
  detailTypeName: string
  campId: string
  campLabel: string
  landLabel: string
  resourceTypeId: string
  resourceTypeName: string
  resourceItemName: string
  quantityUnitLabel: string
  quantityLabel: string
  sourceAmountLabel: string
  sourceUnitLabel: string
  preparedAmountLabel: string
  preparedUnitLabel: string
  preparationStateLabel: string
  preparedAtLabel: string
  hasPreparedChange: boolean
  statusLabel: string
  statusRawName: string
  statusKind: string
  rowType: PreparationRowType
  preparationType: string
  isPrepared: boolean
  hasSoilData: boolean
  preparationInfo: CarbonPreparationInfo
  original: CarbonProcessQueueItem
}

type PreparationRowType = 'fertilizer' | 'fuel' | 'other'
type BulkFuelTarget = 'keep' | 'liter' | 'm3'
type BulkOtherMode = 'keep' | 'factor'
type BulkPreparationPopupState =
  | { kind: 'hidden' }
  | { kind: 'loading'; current: number; total: number; currentLabel: string }
  | { kind: 'success'; itemCount: number; countdown: number }

type StatusTransitionPopupState =
  | { kind: 'hidden' }
  | { kind: 'loading'; itemCount: number }
  | { kind: 'success'; itemCount: number; countdown: number }

type BulkConversionPreview = {
  row: QueueRow
  rowType: PreparationRowType
  ruleLabel: string
  currentUnitLabel: string
  formulaText: string
  preparedUnitLabel: string
  preparedVolumeAll: number
  payload: Record<string, unknown>
}

const emptyForm: PreparationForm = {
  preparedUnitId: '',
  preparedUnitName: '',
  preparedUnitInitial: '',
  preparedUnitPrefixId: '',
  preparedVolumeAll: '',
  preparedVolumePerUnit: '',
  conversionFactor: '',
  fertilizerBagWeightKg: '',
  fertilizerPrepareType: '',
  soilSampleDate: '',
  soilN: '',
  soilSocBaseline: '',
  soilSocProject: '',
  note: '',
}

function formatNumber(value?: number | null, digits = 3) {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })
}

function formatFormNumber(value: number) {
  if (!Number.isFinite(value)) return ''
  return String(Math.round(value * 1_000_000) / 1_000_000)
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'เกิดข้อผิดพลาดระหว่างทำรายการ'
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function calculatePreparedVolumePerUnit(quantity?: number | null, preparedVolumeAll?: number | null) {
  if (quantity == null || preparedVolumeAll == null || !Number.isFinite(quantity) || !Number.isFinite(preparedVolumeAll) || quantity === 0) {
    return undefined
  }
  return preparedVolumeAll / quantity
}

function toNumberOrUndefined(value: string) {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeUnitText(value?: string | null) {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, '')
}

function unitLabel(unit?: Unit | null) {
  if (!unit) return '—'
  return unit.unit_initial || unit.unit_name || `#${unit.unit_id}`
}

function prefixLabel(prefix?: UnitPrefix | null) {
  if (!prefix) return '—'
  return prefix.unit_prefix_initial || prefix.unit_prefix_name || `#${prefix.unit_prefix_id}`
}

function dateInputValue(value?: string | null) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
}

function parsePreparationInfo(value?: string | null): CarbonPreparationInfo {
  if (!value) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as CarbonPreparationInfo
    }
  } catch {
    return { note: value }
  }
  return {}
}

function getResourceItemName(detail?: QueueLogDetail) {
  return detail?.activities_fertilizers?.act_fertilizer_name
    ?? detail?.activities_equipments?.act_equipment_name
    ?? detail?.activities_chemiscals?.act_chemiscal_name
    ?? detail?.activities_resourceOther?.act_resourceOther_name
    ?? '—'
}

function getQueueStatusName(item: CarbonProcessQueueItem) {
  return item.log_act_detail_calStatus?.log_act_detail_calStatus_name
    ?? item.log_activities_detail?.log_act_detail_calStatus?.log_act_detail_calStatus_name
    ?? ''
}

function getPreparationTypeLabel(value?: string | null) {
  if (value === 'chemical') return 'ปุ๋ยเคมี'
  if (value === 'organic') return 'ปุ๋ยอินทรีย์'
  if (value === 'fuel') return 'น้ำมัน'
  if (value === 'soil') return 'ตรวจดิน / SOC'
  if (value === 'other') return 'อื่น ๆ'
  return 'ยังไม่ระบุ'
}

function getPreparationStateBadgeClass(row: QueueRow) {
  if (!row.isPrepared) return 'inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700'
  if (row.hasPreparedChange) return 'inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700'
  return 'inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700'
}

function getDefaultPreparationType(rowType: PreparationRowType) {
  if (rowType === 'fertilizer') return 'chemical'
  if (rowType === 'fuel') return 'fuel'
  return 'other'
}

export function CarbonFootprintQueuePage({
  mode = 'footprint',
  embedded = false,
}: {
  mode?: QueuePageMode
  embedded?: boolean
}) {
  const isPreparationMode = mode === 'preparation'
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState(isPreparationMode ? 'preparing' : '')
  const [resourceTypeFilter, setResourceTypeFilter] = useState('')
  const [campFilter, setCampFilter] = useState('')
  const [preparationFilter, setPreparationFilter] = useState('')
  const [selectedQueueIds, setSelectedQueueIds] = useState<number[]>([])
  const [selectedRow, setSelectedRow] = useState<QueueRow | null>(null)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkFertilizerBagWeightKg, setBulkFertilizerBagWeightKg] = useState('50')
  const [bulkFertilizerPrepareType, setBulkFertilizerPrepareType] = useState('chemical')
  const [bulkFertilizerTargetUnitName, setBulkFertilizerTargetUnitName] = useState('kg')
  const [bulkFertilizerTargetUnitInitial, setBulkFertilizerTargetUnitInitial] = useState('kg')
  const [bulkFuelTarget, setBulkFuelTarget] = useState<BulkFuelTarget>('keep')
  const [bulkFuelValuePerUnit, setBulkFuelValuePerUnit] = useState('1')
  const [bulkOtherMode, setBulkOtherMode] = useState<BulkOtherMode>('keep')
  const [bulkOtherConversionFactor, setBulkOtherConversionFactor] = useState('1')
  const [bulkOtherPreparedUnitId, setBulkOtherPreparedUnitId] = useState('')
  const [bulkOtherPreparedUnitPrefixId, setBulkOtherPreparedUnitPrefixId] = useState('')
  const [bulkModalError, setBulkModalError] = useState<string | null>(null)
  const [bulkPreparationPopup, setBulkPreparationPopup] = useState<BulkPreparationPopupState>({ kind: 'hidden' })
  const [statusPopup, setStatusPopup] = useState<StatusTransitionPopupState>({ kind: 'hidden' })
  const [form, setForm] = useState<PreparationForm>(emptyForm)

  const { data: queue = [], isLoading, error: queueError } = useQuery({
    queryKey: ['carbon-process-queue'],
    queryFn: () => get<CarbonProcessQueueItem[]>('/activities/carbon-process-queue'),
  })
  const { data: units = [], error: unitsError } = useQuery({
    queryKey: ['units-carbon-footprint'],
    queryFn: () => get<Unit[]>('/emission-factors/units'),
  })
  const { data: headerTypes = [], error: headerTypesError } = useQuery({
    queryKey: ['header-types-carbon-footprint'],
    queryFn: () => get<HeaderType[]>('/activities/header-types'),
  })
  const { data: detailTypes = [], error: detailTypesError } = useQuery({
    queryKey: ['detail-types-carbon-footprint'],
    queryFn: () => get<DetailType[]>('/activities/detail-types'),
  })
  const { data: unitPrefixes = [], error: unitPrefixesError } = useQuery({
    queryKey: ['unit-prefixs-carbon-footprint'],
    queryFn: () => get<UnitPrefix[]>('/emission-factors/unit-prefixs'),
  })

  const unitById = useMemo(() => Object.fromEntries(units.map((unit) => [unit.unit_id, unit])), [units])
  const prefixById = useMemo(() => Object.fromEntries(unitPrefixes.map((prefix) => [prefix.unit_prefix_id, prefix])), [unitPrefixes])
  const headerTypeMap = useMemo(
    () => Object.fromEntries(headerTypes.map((item) => [item.act_header_type_id, item.act_header_type_name_th])),
    [headerTypes],
  )
  const detailTypeMap = useMemo(
    () => Object.fromEntries(detailTypes.map((item) => [item.act_header_detail_type_id, item.act_header_detail_type_name_th])),
    [detailTypes],
  )

  const findUnit = (aliases: string[]) => units.find((unit) => {
    const names = [unit.unit_name, unit.unit_initial].map(normalizeUnitText)
    return names.some((name) => aliases.includes(name))
  })

  const kgUnit = findUnit(['kg', 'กิโลกรัม', 'kilogram', 'kilograms'])
  const literUnit = findUnit(['l', 'lit', 'liter', 'litre', 'litter', 'ลิตร'])
  const cubicMeterUnit = findUnit(['m3', 'm^3', 'm³', 'cubicmeter', 'cubicmetre', 'ลูกบาศก์เมตร'])

  const getDetailUnitText = (detail?: QueueLogDetail) => (
    [detail?.units?.unit_name, detail?.units?.unit_initial, detail?.units_prefixs?.unit_prefix_name, detail?.units_prefixs?.unit_prefix_initial]
      .map(normalizeUnitText)
      .filter(Boolean)
      .join(' ')
  )

  const getDetailResourceText = (detail?: QueueLogDetail) => (
    [
      detail?.resource_used_type?.resc_used_type_name,
      getResourceItemName(detail),
      detail?.activities_fertilizers?.act_fertilizer_name,
      detail?.activities_equipments?.act_equipment_name,
      detail?.activities_chemiscals?.act_chemiscal_name,
      detail?.activities_resourceOther?.act_resourceOther_name,
      detail?.units?.unit_name,
      detail?.units?.unit_initial,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
  )

  const isBagUnitText = (value: string) => /sck|sack|bag|กระสอบ/.test(value)
  const isLiterUnitText = (value: string) => /(^|\s)(l|lit|liter|litre|litter|ลิตร)(\s|$)/.test(value)
  const isCubicMeterUnitText = (value: string) => /m3|m\^3|m³|cubicmeter|cubicmetre|ลูกบาศก์เมตร/.test(value)
  const isFuelText = (value: string) => /น้ำมัน|fuel|diesel|gasohol|benzene|เบนซิน|lit|liter|litre|litter|ลิตร|m3|m\^3|m³|ลูกบาศก์เมตร/.test(value)

  const getRowTypeFromDetail = (detail?: QueueLogDetail): PreparationRowType => {
    const unitText = getDetailUnitText(detail)
    const resourceText = getDetailResourceText(detail)

    if (detail?.act_fertilizer_id != null || /ปุ๋ย|fertilizer/.test(resourceText) || isBagUnitText(unitText)) {
      return 'fertilizer'
    }

    if (isFuelText(resourceText)) {
      return 'fuel'
    }

    return 'other'
  }

  const rows = useMemo<QueueRow[]>(() => queue.map((item) => {
    const detail = item.log_activities_detail
    const preparationInfo = parsePreparationInfo(item.carbon_process_queue_info)
    const statusRawName = getQueueStatusName(item)
    const statusId = item.log_act_detail_calStatus_id ?? detail?.log_act_detail_calStatus_id
    const campId = item.land_camp_id ?? detail?.activities_header?.lands?.land_camp_id
    const landLabel = detail?.activities_header?.lands?.land_code
      ?? detail?.activities_header?.lands?.name
      ?? (item.land_id != null ? `#${item.land_id}` : '—')
    const sourceUnit = unitById[preparationInfo.sourceUnitId ?? detail?.unit_id ?? 0]
    const preparedUnitId = detail?.unit_id
    const preparedPrefixId = detail?.unit_prefix_id
    const preparedUnit = unitById[preparedUnitId ?? 0]
    const sourcePrefix = prefixById[preparationInfo.sourceUnitPrefixId ?? detail?.unit_prefix_id ?? 0]
    const preparedPrefix = prefixById[preparedPrefixId ?? 0]
    const sourceVolumeAll = preparationInfo.sourceVolumeAll ?? detail?.log_act_detail_volumeAll
    const preparedVolumeAll = detail?.log_act_detail_volumeAll
    const quantityUnitLabel = [
      prefixLabel(detail?.units_prefixs),
      unitLabel(detail?.units),
    ].filter((value) => value && value !== '—').join(' ') || '—'
    const sourceUnitLabel = [
      prefixLabel(sourcePrefix) !== '—' ? prefixLabel(sourcePrefix) : '',
      unitLabel(sourceUnit),
    ].filter(Boolean).join(' ')
    const preparedUnitLabel = [
      prefixLabel(preparedPrefix) !== '—' ? prefixLabel(preparedPrefix) : '',
      unitLabel(preparedUnit),
    ].filter(Boolean).join(' ')
    const rowType = getRowTypeFromDetail(detail)
    const isPrepared = Boolean(
      preparationInfo.preparedAt
      || preparationInfo.conversionFactor != null
      || preparationInfo.fertilizerBagWeightKg != null
      || preparationInfo.fertilizerPrepareType
      || preparationInfo.soilN != null
      || preparationInfo.soilSocBaseline != null
      || preparationInfo.soilSocProject != null
      || preparationInfo.soilSampleDate
      || preparationInfo.note,
    )
    const hasPreparedChange = Boolean(
      (preparationInfo.sourceUnitId != null && preparationInfo.sourceUnitId !== detail?.unit_id)
      || (preparationInfo.sourceUnitPrefixId != null && preparationInfo.sourceUnitPrefixId !== detail?.unit_prefix_id)
      || (preparationInfo.sourceVolumeAll != null && preparationInfo.sourceVolumeAll !== detail?.log_act_detail_volumeAll)
    )
    const hasSoilData = item.N != null || preparationInfo.soilSocBaseline != null || preparationInfo.soilSocProject != null || Boolean(preparationInfo.soilSampleDate)
    const preparationStateLabel = !isPrepared
      ? 'รอเตรียมข้อมูล'
      : hasPreparedChange
        ? 'แปลงหน่วยแล้ว'
        : 'เตรียมข้อมูลแล้ว'
    const preparedAtLabel = preparationInfo.preparedAt ? formatBangkokDateTime(preparationInfo.preparedAt) : '—'

    return {
      id: item.carbon_process_queue_id,
      checked: selectedQueueIds.includes(item.carbon_process_queue_id),
      detailId: detail?.log_act_detail_id ?? item.log_act_detail_id ?? 0,
      dateLabel: formatBangkokDate(item.carbon_process_queue_dateWork ?? detail?.log_act_detail_create_at ?? detail?.activities_header?.activities_header_startDate),
      headerLabel: detail?.activities_header?.activities_header_idCode ?? (detail?.activities_header_id != null ? `#${detail.activities_header_id}` : '—'),
      activityTypeName: headerTypeMap[detail?.act_header_type_id ?? 0] ?? (detail?.act_header_type_id != null ? String(detail.act_header_type_id) : '—'),
      detailTypeName: detailTypeMap[detail?.act_header_detail_type_id ?? 0] ?? (detail?.act_header_detail_type_id != null ? String(detail.act_header_detail_type_id) : '—'),
      campId: campId != null ? String(campId) : '',
      campLabel: item.lands_camps?.land_camp_name ?? detail?.activities_header?.lands?.lands_camps?.land_camp_name ?? '—',
      landLabel,
      resourceTypeId: detail?.resource_used_type_id != null ? String(detail.resource_used_type_id) : '',
      resourceTypeName: detail?.resource_used_type?.resc_used_type_name ?? '—',
      resourceItemName: getResourceItemName(detail),
      quantityUnitLabel,
      quantityLabel: formatNumber(detail?.log_act_detail_quatity),
      sourceAmountLabel: formatNumber(sourceVolumeAll),
      sourceUnitLabel,
      preparedAmountLabel: isPrepared ? formatNumber(preparedVolumeAll) : '—',
      preparedUnitLabel: isPrepared ? preparedUnitLabel : '—',
      preparationStateLabel,
      preparedAtLabel,
      hasPreparedChange,
      statusLabel: getActivityCalStatusLabel(statusRawName, statusId),
      statusRawName,
      statusKind: getActivityCalStatusKind(statusRawName, statusId),
      rowType,
      preparationType: preparationInfo.fertilizerPrepareType ?? '',
      isPrepared,
      hasSoilData,
      preparationInfo,
      original: item,
    }
  }), [detailTypeMap, headerTypeMap, prefixById, queue, selectedQueueIds, unitById])

  const scopedRows = isPreparationMode
    ? rows
    : rows.filter((row) => row.statusKind === 'ready')

  const filteredRows = scopedRows.filter((row) =>
    (!statusFilter || row.statusKind === statusFilter)
    && (!resourceTypeFilter || row.resourceTypeId === resourceTypeFilter)
    && (!campFilter || row.campId === campFilter)
    && (!preparationFilter || (
      preparationFilter === 'prepared'
        ? row.isPrepared
        : preparationFilter === 'pending'
          ? !row.isPrepared
          : row.preparationType === preparationFilter
    )),
  )

  const resourceTypeOptions = Array.from(new Map(scopedRows.filter((row) => row.resourceTypeId).map((row) => [row.resourceTypeId, row.resourceTypeName])).entries())
  const campOptions = Array.from(new Map(scopedRows.filter((row) => row.campId).map((row) => [row.campId, row.campLabel])).entries())
  const selectedQueueRows = filteredRows.filter((row) => selectedQueueIds.includes(row.id))
  const readyEligibleRows = selectedQueueRows.filter((row) => row.statusKind === 'preparing' && row.isPrepared)
  const readyEligibleDetailIds = readyEligibleRows.map((row) => row.detailId)
  const selectedUnitSummary = Array.from(
    selectedQueueRows.reduce((summary, row) => {
      summary.set(row.quantityUnitLabel, (summary.get(row.quantityUnitLabel) ?? 0) + 1)
      return summary
    }, new Map<string, number>()).entries(),
  )

  const pendingCount = scopedRows.filter((row) => !row.isPrepared).length
  const preparedCount = scopedRows.filter((row) => row.isPrepared).length
  const changedCount = scopedRows.filter((row) => row.hasPreparedChange).length
  const soilCount = scopedRows.filter((row) => row.hasSoilData).length
  const readyCount = scopedRows.filter((row) => row.statusKind === 'ready').length
  const errorCount = scopedRows.filter((row) => row.statusKind === 'error').length

  const pageQueryItems = [
    { label: 'Carbon process queue', error: queueError },
    { label: 'หน่วยนับ', error: unitsError },
    { label: 'ประเภทกิจกรรม', error: headerTypesError },
    { label: 'รายละเอียดกิจกรรม', error: detailTypesError },
    { label: 'Prefix หน่วย', error: unitPrefixesError },
  ]

  const dashboardCards = [
    { key: 'total', label: 'รายการใน Queue', icon: <ActivitySquare size={14} className="text-primary-500" />, value: rows.length, className: 'text-primary-700' },
    { key: 'pending', label: 'รอเตรียมข้อมูล', icon: <Clock3 size={14} className="text-accent-500" />, value: pendingCount, className: 'text-accent-700' },
    { key: 'prepared', label: 'เตรียมหน่วยแล้ว', icon: <CheckCircle2 size={14} className="text-primary-500" />, value: preparedCount, className: 'text-primary-700' },
    { key: 'soil', label: 'มีข้อมูลตรวจดิน/SOC', icon: <Leaf size={14} className="text-green-600" />, value: soilCount, className: 'text-green-700' },
    { key: 'ready', label: 'พร้อมคำนวณ', icon: <Calculator size={14} className="text-cyan-600" />, value: readyCount, className: 'text-cyan-700' },
    { key: 'error', label: 'ผิดพลาด', icon: <CircleAlert size={14} className="text-red-500" />, value: errorCount, className: 'text-red-700' },
  ]

  const setFormValue = (key: keyof PreparationForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const toggleSelectedQueueRow = (id: number, checked: boolean) => {
    setSelectedQueueIds((prev) => (
      checked
        ? Array.from(new Set([...prev, id]))
        : prev.filter((item) => item !== id)
    ))
  }

  const selectVisibleQueueRows = () => {
    setSelectedQueueIds((prev) => Array.from(new Set([...prev, ...filteredRows.map((row) => row.id)])))
  }

  const clearSelectedQueueRows = () => setSelectedQueueIds([])
  const closeBulkModal = () => {
    if (bulkPreparationPopup.kind === 'loading') return
    setBulkModalOpen(false)
    setBulkModalError(null)
    setBulkPreparationPopup({ kind: 'hidden' })
  }

  const getRowUnitText = (row: QueueRow) => {
    const detail = row.original.log_activities_detail
    return [detail?.units?.unit_name, detail?.units?.unit_initial, row.sourceUnitLabel, row.quantityUnitLabel]
      .map(normalizeUnitText)
      .filter(Boolean)
      .join(' ')
  }

  const getRowResourceText = (row: QueueRow) => (
    `${row.resourceTypeName} ${row.resourceItemName} ${row.quantityUnitLabel}`.toLowerCase()
  )

  const isBagUnitRow = (row: QueueRow) => /sck|sack|bag|กระสอบ/.test(getRowUnitText(row))
  const isFuelRow = (row: QueueRow) => row.rowType === 'fuel' || /น้ำมัน|fuel|diesel|gasohol|benzene|เบนซิน|lit|liter|litre|litter|ลิตร|m3|m\^3|m³|ลูกบาศก์เมตร/.test(getRowResourceText(row))
  const isLiterRow = (row: QueueRow) => isLiterUnitText(getRowUnitText(row))
  const isCubicMeterRow = (row: QueueRow) => isCubicMeterUnitText(getRowUnitText(row))

  const buildBulkConversionPreview = (row: QueueRow): BulkConversionPreview => {
    const detail = row.original.log_activities_detail
    const quantity = detail?.log_act_detail_quatity ?? 0
    const sourceVolumeAll = row.preparationInfo.sourceVolumeAll ?? detail?.log_act_detail_volumeAll ?? 0
    const bagWeightKg = toNumberOrUndefined(bulkFertilizerBagWeightKg) ?? 50
    const currentUnitLabel = row.quantityUnitLabel
    const preparedVolumePerUnit = calculatePreparedVolumePerUnit(quantity, sourceVolumeAll)

    if (row.rowType === 'fertilizer') {
      if (!isBagUnitRow(row)) {
        return {
          row,
          rowType: 'fertilizer',
          ruleLabel: 'ปุ๋ย: คงหน่วยเดิม',
          currentUnitLabel,
          formulaText: `${formatNumber(sourceVolumeAll)} * 1 = ${formatNumber(sourceVolumeAll)} ${currentUnitLabel}`,
          preparedUnitLabel: currentUnitLabel,
          preparedVolumeAll: sourceVolumeAll,
          payload: {
            preparedUnitId: detail?.unit_id,
            preparedUnitPrefixId: detail?.unit_prefix_id,
            preparedVolumePerUnit: detail?.log_act_detail_volumePerUnit,
            preparedVolumeAll: sourceVolumeAll,
            conversionFactor: 1,
            fertilizerPrepareType: bulkFertilizerPrepareType || 'chemical',
            note: `Bulk fertilizer keep unit: ${sourceVolumeAll} ${currentUnitLabel}`,
          },
        }
      }

      const fertilizerPreparedVolumeAll = quantity * bagWeightKg
      const fertilizerTargetUnitLabel = kgUnit
        ? unitLabel(kgUnit)
        : (bulkFertilizerTargetUnitInitial.trim() || bulkFertilizerTargetUnitName.trim() || 'kg')
      return {
        row,
        rowType: 'fertilizer',
        ruleLabel: 'SCK / กระสอบ -> kg',
        currentUnitLabel,
        formulaText: `${formatNumber(quantity)} * ${formatNumber(bagWeightKg)} = ${formatNumber(fertilizerPreparedVolumeAll)} ${fertilizerTargetUnitLabel}`,
        preparedUnitLabel: fertilizerTargetUnitLabel,
        preparedVolumeAll: fertilizerPreparedVolumeAll,
        payload: {
          preparedUnitId: kgUnit?.unit_id,
          preparedUnitName: kgUnit ? undefined : (bulkFertilizerTargetUnitName.trim() || 'kg'),
          preparedUnitInitial: kgUnit ? undefined : (bulkFertilizerTargetUnitInitial.trim() || 'kg'),
          preparedVolumePerUnit: bagWeightKg,
          preparedVolumeAll: fertilizerPreparedVolumeAll,
          conversionFactor: bagWeightKg,
          fertilizerBagWeightKg: bagWeightKg,
          fertilizerPrepareType: bulkFertilizerPrepareType || 'chemical',
          note: `Bulk fertilizer conversion: ${quantity} ${currentUnitLabel} * ${bagWeightKg} ${fertilizerTargetUnitLabel} = ${fertilizerPreparedVolumeAll} ${fertilizerTargetUnitLabel}`,
        },
      }
    }

    if (row.rowType === 'fuel' || isFuelRow(row)) {
      const sourceIsLiter = isLiterRow(row)
      const sourceIsM3 = isCubicMeterRow(row)
      const canConvertFuelUnit = sourceIsLiter || sourceIsM3
      const targetUnit = canConvertFuelUnit && bulkFuelTarget === 'm3'
        ? cubicMeterUnit
        : canConvertFuelUnit && bulkFuelTarget === 'liter'
          ? literUnit
          : undefined
      const targetUnitId = targetUnit?.unit_id ?? detail?.unit_id
      const targetUnitLabel = targetUnit ? unitLabel(targetUnit) : currentUnitLabel
      const factor = bulkFuelTarget === 'm3' && sourceIsLiter
        ? 0.001
        : bulkFuelTarget === 'liter' && sourceIsM3
          ? 1000
          : 1
      const fuelValuePerUnit = toNumberOrUndefined(bulkFuelValuePerUnit) ?? detail?.log_act_detail_volumePerUnit ?? factor
      const preparedVolumeAll = quantity * fuelValuePerUnit
      const targetText = !canConvertFuelUnit || bulkFuelTarget === 'keep'
        ? 'คงหน่วยเดิม'
        : `เตรียมเป็น ${targetUnitLabel}`

      return {
        row,
        rowType: 'fuel',
        ruleLabel: `น้ำมัน: ${targetText}`,
        currentUnitLabel,
        formulaText: `${formatNumber(quantity)} * ${formatNumber(fuelValuePerUnit, 6)} = ${formatNumber(preparedVolumeAll)} ${targetUnitLabel}`,
        preparedUnitLabel: targetUnitLabel,
        preparedVolumeAll,
        payload: {
          preparedUnitId: targetUnitId,
          preparedVolumePerUnit: fuelValuePerUnit,
          preparedVolumeAll,
          conversionFactor: fuelValuePerUnit,
          fertilizerPrepareType: 'fuel',
          note: `Bulk fuel conversion: ${quantity} ${currentUnitLabel} * ${fuelValuePerUnit} = ${preparedVolumeAll} ${targetUnitLabel}`,
        },
      }
    }

    const otherFactor = bulkOtherMode === 'factor'
      ? (toNumberOrUndefined(bulkOtherConversionFactor) ?? 1)
      : 1
    const otherPreparedVolumeAll = sourceVolumeAll * otherFactor
    const targetUnit = bulkOtherPreparedUnitId ? unitById[Number(bulkOtherPreparedUnitId)] : undefined
    const targetPrefix = bulkOtherPreparedUnitPrefixId ? prefixById[Number(bulkOtherPreparedUnitPrefixId)] : undefined
    const targetUnitLabel = [
      targetPrefix ? prefixLabel(targetPrefix) : '',
      targetUnit ? unitLabel(targetUnit) : currentUnitLabel,
    ].filter(Boolean).join(' ')

    return {
      row,
      rowType: 'other',
      ruleLabel: bulkOtherMode === 'factor' ? 'อื่น ๆ: แปลงด้วยตัวคูณ' : 'อื่น ๆ: คงหน่วยเดิม',
      currentUnitLabel,
      formulaText: `${formatNumber(sourceVolumeAll)} * ${formatNumber(otherFactor, 6)} = ${formatNumber(otherPreparedVolumeAll)} ${targetUnitLabel}`,
      preparedUnitLabel: targetUnitLabel,
      preparedVolumeAll: otherPreparedVolumeAll,
      payload: {
        preparedUnitId: targetUnit?.unit_id ?? detail?.unit_id,
        preparedUnitPrefixId: targetPrefix?.unit_prefix_id ?? detail?.unit_prefix_id,
        preparedVolumePerUnit: bulkOtherMode === 'factor' ? calculatePreparedVolumePerUnit(quantity, otherPreparedVolumeAll) ?? preparedVolumePerUnit : undefined,
        preparedVolumeAll: otherPreparedVolumeAll,
        conversionFactor: otherFactor,
        fertilizerPrepareType: 'other',
        note: bulkOtherMode === 'factor'
          ? `Bulk other conversion: ${sourceVolumeAll} ${currentUnitLabel} * ${otherFactor} = ${otherPreparedVolumeAll} ${targetUnitLabel}`
          : `Bulk keep unit: ${sourceVolumeAll} ${currentUnitLabel}`,
      },
    }
  }

  const bulkConversionPreview = selectedQueueRows.map(buildBulkConversionPreview)
  const selectedFertilizerRows = selectedQueueRows.filter((row) => row.rowType === 'fertilizer')
  const selectedFuelRows = selectedQueueRows.filter((row) => row.rowType === 'fuel')
  const selectedOtherRows = selectedQueueRows.filter((row) => row.rowType === 'other')
  const bulkFertilizerPreview = bulkConversionPreview.filter((item) => item.rowType === 'fertilizer')
  const bulkFuelPreview = bulkConversionPreview.filter((item) => item.rowType === 'fuel')
  const bulkOtherPreview = bulkConversionPreview.filter((item) => item.rowType === 'other')
  const getBulkFuelPresetValue = (target: BulkFuelTarget) => {
    const hasLiter = selectedFuelRows.some(isLiterRow)
    const hasCubicMeter = selectedFuelRows.some(isCubicMeterRow)
    if (target === 'm3') return hasLiter && !hasCubicMeter ? '0.001' : '1'
    if (target === 'liter') return hasCubicMeter && !hasLiter ? '1000' : '1'
    return '1'
  }

  useEffect(() => {
    if (bulkPreparationPopup.kind !== 'success') return undefined

    const timer = window.setTimeout(() => {
      setBulkPreparationPopup((prev) => {
        if (prev.kind !== 'success') return prev
        if (prev.countdown <= 1) {
          setBulkModalOpen(false)
          setSelectedQueueIds([])
          return { kind: 'hidden' }
        }
        return { ...prev, countdown: prev.countdown - 1 }
      })
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [bulkPreparationPopup])

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

  const sourceVolume = selectedRow
    ? selectedRow.preparationInfo.sourceVolumeAll ?? selectedRow.original.log_activities_detail?.log_act_detail_volumeAll ?? 0
    : 0
  const sourceQuantity = selectedRow?.original.log_activities_detail?.log_act_detail_quatity ?? 0
  const sourceUnit = selectedRow
    ? unitById[selectedRow.preparationInfo.sourceUnitId ?? selectedRow.original.log_activities_detail?.unit_id ?? 0]
    : undefined
  const normalizedSourceUnit = [sourceUnit?.unit_name, sourceUnit?.unit_initial].map(normalizeUnitText)
  const sourceIsLiter = normalizedSourceUnit.some((value) => ['l', 'lit', 'liter', 'litre', 'litter', 'ลิตร'].includes(value))
  const sourceIsCubicMeter = normalizedSourceUnit.some((value) => ['m3', 'm^3', 'm³', 'cubicmeter', 'cubicmetre', 'ลูกบาศก์เมตร'].includes(value))

  const openPreparationForm = (row: QueueRow) => {
    const item = row.original
    const detail = item.log_activities_detail
    const preparationInfo = row.preparationInfo
    const defaultPreparationType = preparationInfo.fertilizerPrepareType ?? getDefaultPreparationType(row.rowType)
    setSelectedRow(row)
    setForm({
      preparedUnitId: detail?.unit_id != null ? String(detail.unit_id) : '',
      preparedUnitName: '',
      preparedUnitInitial: '',
      preparedUnitPrefixId: detail?.unit_prefix_id != null ? String(detail.unit_prefix_id) : '',
      preparedVolumeAll: detail?.log_act_detail_volumeAll != null ? String(detail.log_act_detail_volumeAll) : '',
      preparedVolumePerUnit: detail?.log_act_detail_volumePerUnit != null ? String(detail.log_act_detail_volumePerUnit) : '',
      conversionFactor: preparationInfo.conversionFactor != null ? String(preparationInfo.conversionFactor) : '',
      fertilizerBagWeightKg: preparationInfo.fertilizerBagWeightKg != null ? String(preparationInfo.fertilizerBagWeightKg) : '',
      fertilizerPrepareType: defaultPreparationType,
      soilSampleDate: dateInputValue(preparationInfo.soilSampleDate),
      soilN: item.N != null ? String(item.N) : (preparationInfo.soilN != null ? String(preparationInfo.soilN) : ''),
      soilSocBaseline: preparationInfo.soilSocBaseline != null ? String(preparationInfo.soilSocBaseline) : '',
      soilSocProject: preparationInfo.soilSocProject != null ? String(preparationInfo.soilSocProject) : '',
      note: preparationInfo.note ?? '',
    })
  }

  const closePreparationForm = () => {
    setSelectedRow(null)
    setForm(emptyForm)
  }

  const applyFertilizerBag = (weightKg: number) => {
    const result = sourceQuantity * weightKg
    setForm((prev) => ({
      ...prev,
      fertilizerPrepareType: prev.fertilizerPrepareType || 'chemical',
      fertilizerBagWeightKg: String(weightKg),
      preparedUnitId: kgUnit ? String(kgUnit.unit_id) : '',
      preparedUnitName: kgUnit ? '' : (prev.preparedUnitName || 'kg'),
      preparedUnitInitial: kgUnit ? '' : (prev.preparedUnitInitial || 'kg'),
      preparedVolumePerUnit: String(weightKg),
      conversionFactor: String(weightKg),
      preparedVolumeAll: formatFormNumber(result),
    }))
  }

  const applyFuelLiter = () => {
    const factor = sourceIsCubicMeter ? 1000 : 1
    const preparedVolumeAll = sourceVolume * factor
    const preparedVolumePerUnit = calculatePreparedVolumePerUnit(sourceQuantity, preparedVolumeAll)
    setForm((prev) => ({
      ...prev,
      fertilizerPrepareType: 'fuel',
      preparedUnitId: literUnit ? String(literUnit.unit_id) : prev.preparedUnitId,
      conversionFactor: String(factor),
      preparedVolumePerUnit: preparedVolumePerUnit != null ? formatFormNumber(preparedVolumePerUnit) : prev.preparedVolumePerUnit,
      preparedVolumeAll: formatFormNumber(preparedVolumeAll),
    }))
  }

  const applyFuelCubicMeter = () => {
    const factor = sourceIsLiter ? 0.001 : 1
    const preparedVolumeAll = sourceVolume * factor
    const preparedVolumePerUnit = calculatePreparedVolumePerUnit(sourceQuantity, preparedVolumeAll)
    setForm((prev) => ({
      ...prev,
      fertilizerPrepareType: 'fuel',
      preparedUnitId: cubicMeterUnit ? String(cubicMeterUnit.unit_id) : prev.preparedUnitId,
      conversionFactor: String(factor),
      preparedVolumePerUnit: preparedVolumePerUnit != null ? formatFormNumber(preparedVolumePerUnit) : prev.preparedVolumePerUnit,
      preparedVolumeAll: formatFormNumber(preparedVolumeAll),
    }))
  }

  const preparationMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      put(`/activities/carbon-process-queue/${id}/preparation`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['carbon-process-queue'] })
      void qc.invalidateQueries({ queryKey: ['activity-details-calculate'] })
      void qc.invalidateQueries({ queryKey: ['activity-details'] })
      void qc.invalidateQueries({ queryKey: ['units-carbon-footprint'] })
      void qc.invalidateQueries({ queryKey: ['units'] })
      closePreparationForm()
    },
  })

  const bulkPreparationMut = useMutation({
    mutationFn: async ({ items }: { items: BulkConversionPreview[] }) => {
      const updated = []
      setBulkModalError(null)
      setBulkPreparationPopup({
        kind: 'loading',
        current: 0,
        total: items.length,
        currentLabel: '',
      })

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index]
        setBulkPreparationPopup({
          kind: 'loading',
          current: index + 1,
          total: items.length,
          currentLabel: `${item.row.headerLabel} · ${item.row.resourceItemName}`,
        })

        try {
          updated.push(await put(`/activities/carbon-process-queue/${item.row.id}/preparation`, item.payload))
          if (index < items.length - 1) {
            await wait(120)
          }
        } catch (error) {
          throw new Error(`รายการที่ ${index + 1}/${items.length}: ${item.row.headerLabel} · ${item.row.resourceItemName} - ${getErrorMessage(error)}`)
        }
      }
      return updated
    },
    onSuccess: async (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ['carbon-process-queue'] })
      void qc.invalidateQueries({ queryKey: ['activity-details-calculate'] })
      void qc.invalidateQueries({ queryKey: ['activity-details'] })
      void qc.invalidateQueries({ queryKey: ['units-carbon-footprint'] })
      void qc.invalidateQueries({ queryKey: ['units'] })
      setBulkModalError(null)
      setBulkPreparationPopup({
        kind: 'success',
        itemCount: variables.items.length,
        countdown: 4,
      })
    },
    onError: (error) => {
      setBulkPreparationPopup({ kind: 'hidden' })
      setBulkModalError(getErrorMessage(error))
    },
  })

  const statusMut = useMutation({
    mutationFn: ({ detailIds, statusName }: { detailIds: number[]; statusName: string }) => (
      detailIds.length === 1
        ? post(`/activities/details/${detailIds[0]}/manual-status`, { statusName })
        : post('/activities/details/manual-status/bulk', { ids: detailIds, statusName })
    ),
    onMutate: ({ detailIds }) => {
      setStatusPopup({ kind: 'loading', itemCount: detailIds.length })
    },
    onSuccess: async (_data, variables) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['carbon-process-queue'] }),
        qc.invalidateQueries({ queryKey: ['activity-details-calculate'] }),
        qc.invalidateQueries({ queryKey: ['activity-details'] }),
      ])
      setSelectedQueueIds([])
      setStatusPopup({
        kind: 'success',
        itemCount: variables.detailIds.length,
        countdown: 4,
      })
    },
    onError: () => {
      setStatusPopup({ kind: 'hidden' })
    },
  })

  const calculateMut = useMutation({
    mutationFn: ({ detailId, calcMode }: { detailId: number; calcMode: 'standard' | 'tver' }) =>
      post(`/activities/details/${detailId}/calculate`, { calcMode }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['carbon-process-queue'] })
      void qc.invalidateQueries({ queryKey: ['activity-details-calculate'] })
      void qc.invalidateQueries({ queryKey: ['activity-details'] })
    },
  })

  const submitPreparation = (event: FormEvent) => {
    event.preventDefault()
    if (!selectedRow) return

    preparationMut.mutate({
      id: selectedRow.id,
      payload: {
        preparedUnitId: toNumberOrUndefined(form.preparedUnitId),
        preparedUnitName: form.preparedUnitId ? undefined : (form.preparedUnitName || undefined),
        preparedUnitInitial: form.preparedUnitId ? undefined : (form.preparedUnitInitial || undefined),
        preparedUnitPrefixId: toNumberOrUndefined(form.preparedUnitPrefixId),
        preparedVolumeAll: toNumberOrUndefined(form.preparedVolumeAll),
        preparedVolumePerUnit: toNumberOrUndefined(form.preparedVolumePerUnit),
        conversionFactor: toNumberOrUndefined(form.conversionFactor),
        fertilizerBagWeightKg: toNumberOrUndefined(form.fertilizerBagWeightKg),
        fertilizerPrepareType: form.fertilizerPrepareType || undefined,
        soilSampleDate: form.soilSampleDate || undefined,
        soilN: toNumberOrUndefined(form.soilN),
        soilSocBaseline: toNumberOrUndefined(form.soilSocBaseline),
        soilSocProject: toNumberOrUndefined(form.soilSocProject),
        note: form.note || undefined,
      },
    })
  }

  const clearFilters = () => {
    setStatusFilter(isPreparationMode ? 'preparing' : 'ready')
    setResourceTypeFilter('')
    setCampFilter('')
    setPreparationFilter('')
  }

  const preparationColumns: Column<QueueRow>[] = [
    ...(isPreparationMode ? [{
      key: 'checked',
      header: 'เลือก',
      width: '70px',
      render: (row: QueueRow) => (
        <input
          type="checkbox"
          checked={Boolean(row.checked)}
          onChange={(event) => toggleSelectedQueueRow(row.id, event.target.checked)}
        />
      ),
    }] : []),
    { key: 'dateLabel', header: 'วันที่กิจกรรม', sortable: true },
    { key: 'headerLabel', header: 'หัวข้อกิจกรรม', sortable: true },
    { key: 'activityTypeName', header: 'กิจกรรม', sortable: true },
    { key: 'detailTypeName', header: 'รายละเอียด', sortable: true },
    { key: 'resourceTypeName', header: 'ประเภทปัจจัย', sortable: true },
    { key: 'resourceItemName', header: 'รายการปัจจัย', sortable: true },
    { key: 'quantityUnitLabel', header: 'unit จำนวน', sortable: true },
    { key: 'quantityLabel', header: 'จำนวน', sortable: true, render: (row) => <span className="font-mono">{row.quantityLabel}</span> },
    { key: 'sourceUnitLabel', header: 'หน่วยเดิม', sortable: true },
    { key: 'sourceAmountLabel', header: 'ปริมาณรวมเดิม', sortable: true, render: (row) => <span className="font-mono">{row.sourceAmountLabel}</span> },
    { key: 'preparedUnitLabel', header: 'หน่วยหลังเตรียม', sortable: true, render: (row) => <span className={row.isPrepared ? 'font-medium text-emerald-700' : 'text-surface-400'}>{row.preparedUnitLabel}</span> },
    { key: 'preparedAmountLabel', header: 'ปริมาณรวมหลังเตรียม', sortable: true, render: (row) => <span className={`font-mono ${row.isPrepared ? 'text-emerald-700' : 'text-surface-400'}`}>{row.preparedAmountLabel}</span> },
    {
      key: 'preparationStateLabel',
      header: 'สถานะการเตรียม',
      sortable: true,
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span className={getPreparationStateBadgeClass(row)}>{row.preparationStateLabel}</span>
          {row.isPrepared && <span className="text-[11px] text-surface-500">อัปเดตล่าสุด {row.preparedAtLabel}</span>}
        </div>
      ),
    },
    {
      key: 'statusLabel',
      header: 'สถานะ',
      sortable: true,
      render: (row) => <span className={getActivityCalStatusBadgeClass(row.statusRawName, row.original.log_act_detail_calStatus_id)}>{row.statusLabel}</span>,
    },
  ]

  const footprintColumns: Column<QueueRow>[] = [
    { key: 'dateLabel', header: 'วันที่กิจกรรม', sortable: true },
    { key: 'campLabel', header: 'แคมป์', sortable: true, render: (row) => <span className="badge-blue">{row.campLabel}</span> },
    { key: 'landLabel', header: 'แปลง', sortable: true, render: (row) => <span className="badge-green">{row.landLabel}</span> },
    { key: 'resourceTypeName', header: 'ประเภทปัจจัย', sortable: true },
    { key: 'resourceItemName', header: 'รายการปัจจัย', sortable: true },
    { key: 'sourceAmountLabel', header: 'ปริมาณเดิม', sortable: true, render: (row) => <span className="font-mono">{row.sourceAmountLabel}</span> },
    { key: 'sourceUnitLabel', header: 'หน่วยเดิม', sortable: true },
    { key: 'preparedAmountLabel', header: 'ปริมาณหลังเตรียม', sortable: true, render: (row) => <span className="font-mono">{row.preparedAmountLabel}</span> },
    { key: 'preparedUnitLabel', header: 'หน่วยหลังเตรียม', sortable: true },
    {
      key: 'statusLabel',
      header: 'สถานะ',
      sortable: true,
      render: (row) => <span className={getActivityCalStatusBadgeClass(row.statusRawName, row.original.log_act_detail_calStatus_id)}>{row.statusLabel}</span>,
    },
  ]
  const columns = isPreparationMode ? preparationColumns : footprintColumns

  const selectedRowType = selectedRow?.rowType ?? 'other'
  const selectedIsFertilizer = selectedRowType === 'fertilizer'
  const selectedIsFuel = selectedRowType === 'fuel'
  const canApplyFuelPresets = selectedIsFuel && (sourceIsLiter || sourceIsCubicMeter)
  const previewPreparedVolume = toNumberOrUndefined(form.preparedVolumeAll)
  const previewDiff = previewPreparedVolume != null ? previewPreparedVolume - sourceVolume : undefined
  const previewPreparedUnitLabel = form.preparedUnitId
    ? unitLabel(unitById[Number(form.preparedUnitId)])
    : (form.preparedUnitInitial || form.preparedUnitName || '—')

  const content = (
    <>
        <div className="card">
          <div className="page-header mb-0">
            <div>
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-surface-900">
                <Calculator size={20} className="text-primary-600 shrink-0" />
                {isPreparationMode ? 'คิวเตรียมข้อมูล Carbon' : 'Carbon Footprint'}
              </h1>
              <p className="page-subtitle">
                {isPreparationMode
                  ? 'จัดการตาราง carbon_process_queue, เตรียมหน่วย ปริมาณ และตรวจสอบความพร้อมก่อนเปลี่ยนเป็น พร้อมคำนวณมาตรฐาน'
                  : 'ใช้เฉพาะข้อมูลสถานะพร้อมคำนวณมาตรฐานจาก carbon_process_queue เพื่อคำนวณ Carbon Footprint'}
              </p>
            </div>
            <div className="source-badge w-full justify-start md:w-auto md:justify-end">
              <span>{isPreparationMode ? 'Preparation Queue' : 'Ready Queue'}</span>
              <span>{filteredRows.length.toLocaleString('th-TH')} รายการที่ตรงเงื่อนไข</span>
            </div>
          </div>
        </div>

        <DatabaseConnectionNotice
          items={pageQueryItems}
          className="mt-4"
          onRetry={() => { void qc.refetchQueries({ type: 'active' }) }}
        />

        {!isPreparationMode && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
            {dashboardCards.map((card) => (
              <div key={card.key} className="stat-card relative overflow-hidden bg-white/90">
                <div className="flex items-center gap-2">
                  {card.icon}
                  <span className="stat-label">{card.label}</span>
                </div>
                <p className={`stat-value ${card.className}`}>{card.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="card min-w-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(91,164,255,0.14)]">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">{isPreparationMode ? 'ตารางคิวเตรียมข้อมูล Carbon' : 'ตาราง Carbon Footprint Ready Queue'}</h2>
              <p className="mt-1 text-xs text-surface-500">
                {isPreparationMode
                  ? 'ปรับข้อมูลให้อยู่ในหน่วยกลาง และยืนยันความพร้อมก่อนเปลี่ยนเป็น พร้อมคำนวณมาตรฐาน'
                  : 'หน้า Carbon Footprint ใช้เฉพาะรายการสถานะพร้อมคำนวณมาตรฐานเท่านั้น และไม่มีขั้นตอนเตรียมข้อมูลในหน้านี้'}
              </p>
            </div>
            <button type="button" className="btn-ghost btn-sm w-full justify-center sm:w-auto" onClick={clearFilters}>
              ล้างตัวกรอง
            </button>
          </div>

          {isPreparationMode && (
            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-[#d9e7f2] bg-white/85 px-4 py-3">
                <div className="text-xs text-surface-500">รอเตรียมข้อมูล</div>
                <div className="mt-1 text-lg font-semibold text-surface-800">{pendingCount.toLocaleString('th-TH')}</div>
              </div>
              <div className="rounded-xl border border-[#d6eadf] bg-[#f6fcf8] px-4 py-3">
                <div className="text-xs text-surface-500">เตรียมข้อมูลแล้ว</div>
                <div className="mt-1 text-lg font-semibold text-blue-700">{preparedCount.toLocaleString('th-TH')}</div>
              </div>
              <div className="rounded-xl border border-[#cfe7d9] bg-[#f2fbf5] px-4 py-3">
                <div className="text-xs text-surface-500">แปลงหน่วยแล้ว</div>
                <div className="mt-1 text-lg font-semibold text-emerald-700">{changedCount.toLocaleString('th-TH')}</div>
              </div>
              <div className="rounded-xl border border-[#d9e7f2] bg-[#f8fbff] px-4 py-3">
                <div className="text-xs text-surface-500">ที่เลือกพร้อมเปลี่ยนสถานะ</div>
                <div className="mt-1 text-lg font-semibold text-primary-700">{readyEligibleDetailIds.length.toLocaleString('th-TH')}</div>
              </div>
            </div>
          )}

          {isPreparationMode && (
            <>
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <button type="button" className="btn-secondary w-full justify-center sm:w-auto" onClick={selectVisibleQueueRows}>
                  เลือกทั้งหมดที่กรอง
                </button>
                <button type="button" className="btn-ghost w-full justify-center sm:w-auto" onClick={clearSelectedQueueRows}>
                  ล้างรายการที่เลือก
                </button>
              </div>

              <div className="mb-4 rounded-[20px] border border-[#d9e7f2] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(243,247,251,0.96))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-primary-600" />
                      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-surface-600">จัดการหลายรายการ</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-xs text-surface-700 sm:grid-cols-3">
                      <div className="flex flex-col gap-1 rounded-xl border border-[#d9e7f2] bg-white/85 px-3 py-2">
                        <span>เลือกอยู่</span>
                        <strong className="text-sm">{selectedQueueIds.length} รายการ</strong>
                      </div>
                      <div className="flex flex-col gap-1 rounded-xl border border-[#d9e7f2] bg-white/85 px-3 py-2">
                        <span>เปลี่ยนเป็นพร้อมได้</span>
                        <strong className="text-sm">{readyEligibleDetailIds.length} รายการ</strong>
                      </div>
                      <div className="flex flex-col gap-1 rounded-xl border border-[#d9e7f2] bg-white/85 px-3 py-2">
                        <span>ที่เลือกแต่ยังไม่พร้อม</span>
                        <strong className="text-sm">{Math.max(selectedQueueIds.length - readyEligibleDetailIds.length, 0)} รายการ</strong>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 xl:max-w-[24rem]">
                      <button
                        type="button"
                        className="btn-secondary btn-sm w-full justify-center"
                        disabled={!readyEligibleDetailIds.length || statusMut.isPending}
                        onClick={() => statusMut.mutate({ detailIds: readyEligibleDetailIds, statusName: ACTIVITY_CAL_STATUS_NAMES.ready })}
                      >
                        <CheckCircle2 size={14} /> ย้ายเป็นพร้อมคำนวณมาตรฐาน
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-4 rounded-[20px] border border-[#cfe3d6] bg-[linear-gradient(180deg,rgba(249,255,251,0.98),rgba(240,249,244,0.98))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <Wand2 size={14} className="text-green-700" />
                      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-surface-600">เตรียมหน่วยหลายรายการ</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-xs text-surface-700 sm:grid-cols-4">
                      <div className="rounded-xl border border-[#d9e7f2] bg-white/85 px-3 py-2">
                        <span className="block text-surface-500">เลือกอยู่</span>
                        <strong className="text-sm">{selectedQueueRows.length} รายการ</strong>
                      </div>
                      <div className="rounded-xl border border-[#d9e7f2] bg-white/85 px-3 py-2">
                        <span className="block text-surface-500">ปุ๋ย</span>
                        <strong className="text-sm">{selectedFertilizerRows.length} รายการ</strong>
                      </div>
                      <div className="rounded-xl border border-[#d9e7f2] bg-white/85 px-3 py-2">
                        <span className="block text-surface-500">น้ำมัน</span>
                        <strong className="text-sm">{selectedFuelRows.length} รายการ</strong>
                      </div>
                      <div className="rounded-xl border border-[#d9e7f2] bg-white/85 px-3 py-2">
                        <span className="block text-surface-500">อื่น ๆ</span>
                        <strong className="text-sm">{selectedOtherRows.length} รายการ</strong>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-primary btn-sm w-full justify-center xl:w-auto"
                    disabled={!selectedQueueRows.length || bulkPreparationMut.isPending}
                    onClick={() => {
                      setBulkModalError(null)
                      setBulkPreparationPopup({ kind: 'hidden' })
                      setBulkModalOpen(true)
                    }}
                  >
                    <Wand2 size={14} /> ทำรายการทั้งหมดจากที่เลือก
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="mb-4 rounded-[20px] border border-[#d9e7f2] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(243,247,251,0.96))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className={`grid grid-cols-1 gap-3 md:grid-cols-2 ${isPreparationMode ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
              {isPreparationMode && (
                <div>
                  <label className="label">สถานะ</label>
                  <select className="select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="">ทั้งหมด</option>
                    <option value="preparing">กำลังเตรียมข้อมูล</option>
                    <option value="ready">พร้อมคำนวณมาตรฐาน</option>
                    <option value="standardDone">คำนวณแล้ว(มาตรฐาน)</option>
                    <option value="cfpDone">คำนวณแล้ว(มาตรฐาน,CFP)</option>
                    <option value="error">คำนวณผิดพลาด</option>
                  </select>
                </div>
              )}
              <div>
                <label className="label">ประเภทปัจจัย</label>
                <select className="select" value={resourceTypeFilter} onChange={(event) => setResourceTypeFilter(event.target.value)}>
                  <option value="">ทั้งหมด</option>
                  {resourceTypeOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">แคมป์</label>
                <select className="select" value={campFilter} onChange={(event) => setCampFilter(event.target.value)}>
                  <option value="">ทั้งหมด</option>
                  {campOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </div>
              {isPreparationMode && (
                <div>
                  <label className="label">ประเภทการเตรียม</label>
                  <select className="select" value={preparationFilter} onChange={(event) => setPreparationFilter(event.target.value)}>
                    <option value="">ทั้งหมด</option>
                    <option value="pending">รอเตรียมข้อมูล</option>
                    <option value="prepared">เตรียมหน่วยแล้ว</option>
                    <option value="chemical">ปุ๋ยเคมี</option>
                    <option value="organic">ปุ๋ยอินทรีย์</option>
                    <option value="fuel">น้ำมัน</option>
                    <option value="soil">ตรวจดิน / SOC</option>
                    <option value="other">อื่น ๆ</option>
                  </select>
                </div>
              )}
              <div>
                <label className="label">จำนวนที่แสดง</label>
                <div className="rounded-xl border border-[#d9e7f2] bg-white/80 px-3 py-2 text-sm text-surface-700 shadow-sm">
                  {filteredRows.length.toLocaleString('th-TH')} รายการ
                </div>
              </div>
            </div>
          </div>

          {((isPreparationMode && (preparationMut.isError || statusMut.isError)) || (!isPreparationMode && calculateMut.isError)) && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
              {preparationMut.error?.message ?? statusMut.error?.message ?? calculateMut.error?.message}
            </div>
          )}

          <DataTable
            data={filteredRows}
            columns={columns}
            isLoading={isLoading}
            rowKey={(row) => row.id}
            searchPlaceholder="ค้นหาแคมป์ แปลง รายการปัจจัย หรือสถานะ..."
            emptyMessage={isPreparationMode ? 'ไม่พบรายการใน carbon_process_queue' : 'ไม่พบรายการสถานะพร้อมคำนวณมาตรฐานสำหรับ Carbon Footprint'}
            actions={(row) => (
              <div className="flex flex-wrap justify-end gap-1">
                {isPreparationMode && (
                  <button type="button" className="btn-ghost btn-sm" onClick={() => openPreparationForm(row)}>
                    <Edit3 size={13} /> เตรียม
                  </button>
                )}
                {isPreparationMode && row.statusKind === 'preparing' && (
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={!row.isPrepared || statusMut.isPending}
                    onClick={() => statusMut.mutate({ detailIds: [row.detailId], statusName: ACTIVITY_CAL_STATUS_NAMES.ready })}
                  >
                    <CheckCircle2 size={13} /> พร้อม
                  </button>
                )}
                {!isPreparationMode && row.statusKind === 'ready' && (
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    disabled={calculateMut.isPending}
                    onClick={() => calculateMut.mutate({ detailId: row.detailId, calcMode: 'standard' })}
                  >
                    <Calculator size={13} /> มาตรฐาน
                  </button>
                )}
              </div>
            )}
          />
        </div>

        {isPreparationMode && bulkModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={closeBulkModal} />
            <div className="relative max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white p-6 shadow-card-lg animate-slide-up">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-base font-semibold">
                    <Wand2 size={17} className="text-primary-600" />
                    ทำรายการทั้งหมดจากที่เลือก
                  </h3>
                  <p className="mt-1 text-xs text-surface-500">ปรับค่าหลังเตรียมลง `log_act_detail` เป็นค่าหลัก และเก็บ metadata สำหรับ tracking ไว้ใน `carbon_process_queue_info`</p>
                </div>
                <button type="button" className="btn-icon btn-ghost" onClick={closeBulkModal} disabled={bulkPreparationPopup.kind === 'loading'}>
                  <X size={16} />
                </button>
              </div>

              {bulkModalError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
                  {bulkModalError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
                <section className="rounded-xl border border-[#d9e7f2] bg-[#f8fbff] p-4">
                  <h4 className="mb-3 text-sm font-semibold">ตั้งค่าการเปลี่ยนหน่วยตามประเภท</h4>

                  <div className="space-y-3">
                    {selectedFertilizerRows.length > 0 && (
                      <div className="rounded-xl border border-[#d9e7f2] bg-white/90 p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <h5 className="text-sm font-semibold text-surface-800">ปุ๋ย</h5>
                            <p className="text-xs text-surface-500">{selectedFertilizerRows.length.toLocaleString('th-TH')} รายการ</p>
                          </div>
                          <span className="rounded-full bg-[#eef6ff] px-3 py-1 text-xs font-medium text-primary-700">SCK / กระสอบ ไป kg</span>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div>
                            <label className="label">ประเภทการเตรียมปุ๋ย</label>
                            <select className="select" value={bulkFertilizerPrepareType} onChange={(event) => setBulkFertilizerPrepareType(event.target.value)}>
                              <option value="chemical">ปุ๋ยเคมี</option>
                              <option value="organic">ปุ๋ยอินทรีย์</option>
                              <option value="other">อื่น ๆ</option>
                            </select>
                          </div>
                          <div>
                            <label className="label">น้ำหนักต่อกระสอบ สำหรับ SCK ไป kg</label>
                            <input
                              type="number"
                              step="0.001"
                              className="input"
                              value={bulkFertilizerBagWeightKg}
                              onChange={(event) => setBulkFertilizerBagWeightKg(event.target.value)}
                            />
                          </div>
                          {!kgUnit && (
                            <>
                              <div>
                                <label className="label">สร้างชื่อหน่วยปลายทาง</label>
                                <input
                                  className="input"
                                  value={bulkFertilizerTargetUnitName}
                                  onChange={(event) => setBulkFertilizerTargetUnitName(event.target.value)}
                                />
                              </div>
                              <div>
                                <label className="label">ตัวย่อหน่วยปลายทาง</label>
                                <input
                                  className="input"
                                  value={bulkFertilizerTargetUnitInitial}
                                  onChange={(event) => setBulkFertilizerTargetUnitInitial(event.target.value)}
                                />
                              </div>
                            </>
                          )}
                        </div>
                        {!kgUnit && (
                          <p className="mt-2 text-xs text-amber-700">
                            ยังไม่พบหน่วย kg ใน master units ระบบจะสร้างหน่วยนี้ระหว่างบันทึก แล้วอัปเดต `log_act_detail.unit_id`
                          </p>
                        )}
                      </div>
                    )}

                    {selectedFuelRows.length > 0 && (
                      <div className="rounded-xl border border-[#d9e7f2] bg-white/90 p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <h5 className="text-sm font-semibold text-surface-800">น้ำมัน</h5>
                            <p className="text-xs text-surface-500">{selectedFuelRows.length.toLocaleString('th-TH')} รายการ</p>
                          </div>
                          <span className="rounded-full bg-[#eefbf7] px-3 py-1 text-xs font-medium text-green-700">L และ m3</span>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div>
                            <label className="label">การจัดการหน่วยน้ำมัน</label>
                            <select
                              className="select"
                              value={bulkFuelTarget}
                              onChange={(event) => {
                                const nextTarget = event.target.value as BulkFuelTarget
                                setBulkFuelTarget(nextTarget)
                                setBulkFuelValuePerUnit(getBulkFuelPresetValue(nextTarget))
                              }}
                            >
                              <option value="keep">คงหน่วยเดิม</option>
                              <option value="liter">เตรียมเป็น L</option>
                              <option value="m3">เตรียมเป็น m3</option>
                            </select>
                          </div>
                          <div>
                            <label className="label">ค่าต่อจำนวน</label>
                            <input
                              type="number"
                              step="0.000001"
                              className="input"
                              value={bulkFuelValuePerUnit}
                              onChange={(event) => setBulkFuelValuePerUnit(event.target.value)}
                            />
                          </div>
                          <p className="text-xs text-surface-500 md:col-span-2">สูตรที่ใช้บันทึกคือ จำนวน * ค่าต่อจำนวน เช่น 1000 * 0.001 = 1 m3</p>
                        </div>
                      </div>
                    )}

                    {selectedOtherRows.length > 0 && (
                      <div className="rounded-xl border border-[#d9e7f2] bg-white/90 p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <h5 className="text-sm font-semibold text-surface-800">อื่น ๆ</h5>
                            <p className="text-xs text-surface-500">{selectedOtherRows.length.toLocaleString('th-TH')} รายการ</p>
                          </div>
                          <span className="rounded-full bg-[#fff8ec] px-3 py-1 text-xs font-medium text-amber-700">Generic conversion</span>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div>
                            <label className="label">โหมดการเตรียมข้อมูล</label>
                            <select className="select" value={bulkOtherMode} onChange={(event) => setBulkOtherMode(event.target.value as BulkOtherMode)}>
                              <option value="keep">คงหน่วยเดิม</option>
                              <option value="factor">แปลงด้วยตัวคูณเดียวกัน</option>
                            </select>
                          </div>
                          <div>
                            <label className="label">ตัวคูณแปลงหน่วย</label>
                            <input
                              type="number"
                              step="0.000001"
                              className="input"
                              value={bulkOtherConversionFactor}
                              onChange={(event) => setBulkOtherConversionFactor(event.target.value)}
                              disabled={bulkOtherMode !== 'factor'}
                            />
                          </div>
                          <div>
                            <label className="label">Prefix หน่วยหลังเตรียม</label>
                            <select className="select" value={bulkOtherPreparedUnitPrefixId} onChange={(event) => setBulkOtherPreparedUnitPrefixId(event.target.value)}>
                              <option value="">— คงค่าเดิม —</option>
                              {unitPrefixes.map((prefix) => <option key={prefix.unit_prefix_id} value={prefix.unit_prefix_id}>{prefixLabel(prefix)}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="label">หน่วยหลังเตรียม</label>
                            <select className="select" value={bulkOtherPreparedUnitId} onChange={(event) => setBulkOtherPreparedUnitId(event.target.value)}>
                              <option value="">— คงค่าเดิม —</option>
                              {units.map((unit) => <option key={unit.unit_id} value={unit.unit_id}>{unitLabel(unit)}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <h5 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-surface-500">Tracking หน่วยปัจจุบัน</h5>
                    <div className="flex flex-wrap gap-2">
                      {selectedUnitSummary.length ? selectedUnitSummary.map(([label, count]) => (
                        <span key={label} className="rounded-full border border-[#d9e7f2] bg-white px-3 py-1 text-xs text-surface-700">
                          {label}: {count.toLocaleString('th-TH')}
                        </span>
                      )) : (
                        <span className="text-xs text-surface-500">ยังไม่ได้เลือกรายการ</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-[#d9e7f2] bg-white/90 p-3 text-xs text-surface-600">
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <strong className="block text-surface-800">Dynamic String Interpolation / Template Literals</strong>
                        <span>ข้อความสูตรด้านขวาถูกสร้างจากค่าที่เลือก เช่น จำนวน, น้ำหนักกระสอบ และ target unit แล้วอัปเดตทันทีเมื่อเปลี่ยนค่า</span>
                      </div>
                      <div>
                        <strong className="block text-surface-800">Frontend Simulation</strong>
                        <span>ผลลัพธ์ในตาราง preview คำนวณบนหน้าเว็บก่อน เพื่อให้เห็นผลก่อนกดบันทึกจริง</span>
                      </div>
                      <div>
                        <strong className="block text-surface-800">Syntax Highlighting</strong>
                        <span>ตัวอย่างสูตรใช้สีแยกคำสั่ง ตัวแปร และตัวเลข เพื่อให้อ่าน logic ได้เร็วขึ้น</span>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-[#d9e7f2] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Code2 size={15} className="text-primary-600" />
                    <h4 className="text-sm font-semibold">Preview สูตรและผลลัพธ์</h4>
                  </div>
                  <div className="space-y-4">
                    {selectedFertilizerRows.length > 0 && (
                      <div className="rounded-xl border border-[#d9e7f2]">
                        <div className="border-b border-[#d9e7f2] bg-[#f8fbff] px-4 py-3">
                          <h5 className="text-sm font-semibold">สูตรปุ๋ย</h5>
                        </div>
                        <div className="p-4">
                          <pre className="overflow-x-auto rounded-xl border border-[#d9e7f2] bg-[#101827] p-4 text-xs leading-6 text-slate-100">
                            <code>
                              <span className="text-sky-300">const</span> <span className="text-emerald-300">bagWeightKg</span> = <span className="text-amber-300">{toNumberOrUndefined(bulkFertilizerBagWeightKg) ?? 50}</span>{'\n'}
                              <span className="text-sky-300">const</span> <span className="text-emerald-300">fertilizerKg</span> = <span className="text-violet-300">quantity</span> * <span className="text-emerald-300">bagWeightKg</span>{'\n'}
                              <span className="text-slate-400">{'// '}</span><span className="text-slate-300">{bulkFertilizerPreview[0]?.formulaText ?? 'เลือกรายการปุ๋ยเพื่อดูสูตรตัวอย่าง'}</span>
                            </code>
                          </pre>
                        </div>
                      </div>
                    )}

                    {selectedFuelRows.length > 0 && (
                      <div className="rounded-xl border border-[#d9e7f2]">
                        <div className="border-b border-[#d9e7f2] bg-[#f8fbff] px-4 py-3">
                          <h5 className="text-sm font-semibold">สูตรน้ำมัน</h5>
                        </div>
                        <div className="p-4">
                          <pre className="overflow-x-auto rounded-xl border border-[#d9e7f2] bg-[#101827] p-4 text-xs leading-6 text-slate-100">
                            <code>
                              <span className="text-sky-300">const</span> <span className="text-emerald-300">fuelValuePerUnit</span> = <span className="text-amber-300">{toNumberOrUndefined(bulkFuelValuePerUnit) ?? 1}</span>{'\n'}
                              <span className="text-sky-300">const</span> <span className="text-emerald-300">fuelResult</span> = <span className="text-violet-300">quantity</span> * <span className="text-emerald-300">fuelValuePerUnit</span>{'\n'}
                              <span className="text-slate-400">{'// '}</span><span className="text-slate-300">{bulkFuelPreview[0]?.formulaText ?? 'เลือกรายการน้ำมันเพื่อดูสูตรตัวอย่าง'}</span>
                            </code>
                          </pre>
                        </div>
                      </div>
                    )}

                    {selectedOtherRows.length > 0 && (
                      <div className="rounded-xl border border-[#d9e7f2]">
                        <div className="border-b border-[#d9e7f2] bg-[#f8fbff] px-4 py-3">
                          <h5 className="text-sm font-semibold">สูตรทั่วไป</h5>
                        </div>
                        <div className="p-4">
                          <pre className="overflow-x-auto rounded-xl border border-[#d9e7f2] bg-[#101827] p-4 text-xs leading-6 text-slate-100">
                            <code>
                              <span className="text-sky-300">const</span> <span className="text-emerald-300">otherFactor</span> = <span className="text-amber-300">{bulkOtherMode === 'factor' ? (toNumberOrUndefined(bulkOtherConversionFactor) ?? 1) : 1}</span>{'\n'}
                              <span className="text-sky-300">const</span> <span className="text-emerald-300">otherResult</span> = <span className="text-violet-300">volumeAll</span> * <span className="text-emerald-300">otherFactor</span>{'\n'}
                              <span className="text-slate-400">{'// '}</span><span className="text-slate-300">{bulkOtherPreview[0]?.formulaText ?? 'เลือกรายการอื่น ๆ เพื่อดูสูตรตัวอย่าง'}</span>
                            </code>
                          </pre>
                        </div>
                      </div>
                    )}

                    {[
                      { key: 'fertilizer', label: 'ปุ๋ย', items: bulkFertilizerPreview },
                      { key: 'fuel', label: 'น้ำมัน', items: bulkFuelPreview },
                      { key: 'other', label: 'อื่น ๆ', items: bulkOtherPreview },
                    ].map((group) => (
                      group.items.length ? (
                        <div key={group.key} className="rounded-xl border border-[#d9e7f2]">
                          <div className="border-b border-[#d9e7f2] bg-[#f8fbff] px-4 py-3">
                            <h5 className="text-sm font-semibold">{group.label}</h5>
                          </div>
                          <div className="max-h-[280px] overflow-auto">
                            <table className="w-full min-w-[760px] text-left text-xs">
                              <thead className="sticky top-0 bg-[#f3f7fb] text-surface-600">
                                <tr>
                                  <th className="px-3 py-2 font-semibold">หัวข้อกิจกรรม</th>
                                  <th className="px-3 py-2 font-semibold">รายการ</th>
                                  <th className="px-3 py-2 font-semibold">หน่วยเดิม</th>
                                  <th className="px-3 py-2 font-semibold">Rule</th>
                                  <th className="px-3 py-2 font-semibold">สูตร</th>
                                  <th className="px-3 py-2 font-semibold">ผลลัพธ์</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#e5eef5] bg-white">
                                {group.items.map((item) => (
                                  <tr key={item.row.id}>
                                    <td className="px-3 py-2 align-top">
                                      <div className="min-w-[140px]">
                                        <div className="font-medium text-surface-800">{item.row.headerLabel}</div>
                                        <div className="text-[11px] text-surface-500">{item.row.activityTypeName}</div>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2 align-top">{item.row.resourceItemName}</td>
                                    <td className="px-3 py-2 align-top">{item.currentUnitLabel}</td>
                                    <td className="px-3 py-2 align-top">{item.ruleLabel}</td>
                                    <td className="px-3 py-2 align-top font-mono">{item.formulaText}</td>
                                    <td className="px-3 py-2 align-top font-mono">{formatNumber(item.preparedVolumeAll)} {item.preparedUnitLabel}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : null
                    ))}

                    {!bulkConversionPreview.length && (
                      <div className="rounded-xl border border-dashed border-[#d9e7f2] px-4 py-8 text-center text-sm text-surface-400">
                        ยังไม่ได้เลือกรายการ
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button type="button" className="btn-secondary flex-1 justify-center" onClick={closeBulkModal} disabled={bulkPreparationPopup.kind === 'loading'}>ยกเลิก</button>
                <button
                  type="button"
                  className="btn-primary flex-1 justify-center"
                  disabled={!bulkConversionPreview.length || bulkPreparationMut.isPending}
                  onClick={() => bulkPreparationMut.mutate({ items: bulkConversionPreview })}
                >
                  {bulkPreparationMut.isPending ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนหน่วยทั้งหมด'}
                </button>
              </div>

              {bulkPreparationPopup.kind !== 'hidden' && (
                <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
                  <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-[#d9e7f2] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,248,253,0.98))] p-6 shadow-[0_28px_80px_rgba(35,49,66,0.24)] animate-slide-up">
                    {bulkPreparationPopup.kind === 'loading' ? (
                      <div className="flex flex-col items-center text-center">
                        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(91,164,255,0.22),rgba(91,164,255,0.08),transparent_72%)]">
                          <LoaderCircle size={40} className="animate-spin text-primary-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-surface-900">กำลังเตรียมข้อมูลทีละรายการ</h3>
                        <p className="mt-2 text-sm text-surface-600">
                          ระบบกำลังบันทึก {bulkPreparationPopup.current.toLocaleString('th-TH')} / {bulkPreparationPopup.total.toLocaleString('th-TH')} รายการ
                        </p>
                        <div className="mt-2 text-sm font-medium text-surface-800">{bulkPreparationPopup.currentLabel || 'กำลังเริ่มทำรายการ'}</div>
                        <div className="mt-4 w-full overflow-hidden rounded-full bg-[#eaf1f7]">
                          <div
                            className="h-2 rounded-full bg-primary-500 transition-all duration-300"
                            style={{ width: `${bulkPreparationPopup.total ? (bulkPreparationPopup.current / bulkPreparationPopup.total) * 100 : 0}%` }}
                          />
                        </div>
                        <div className="mt-4 flex items-center gap-2 rounded-full border border-[#d9e7f2] bg-white/85 px-4 py-2 text-xs text-surface-500 shadow-sm">
                          <span className="loading-dot" />
                          <span className="loading-dot" />
                          <span className="loading-dot" />
                          <span className="ml-1">กำลังส่งคำขอแบบเรียงลำดับทีละ row</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-center">
                        <button
                          type="button"
                          className="absolute right-3 top-3 rounded-full p-2 text-surface-400 transition hover:bg-white/70 hover:text-surface-700"
                          onClick={closeBulkModal}
                        >
                          <X size={16} />
                        </button>
                        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(78,143,106,0.24),rgba(78,143,106,0.08),transparent_72%)]">
                          <CheckCircle2 size={40} className="text-green-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-surface-900">บันทึกการเตรียมข้อมูลสำเร็จแล้ว</h3>
                        <p className="mt-2 text-sm text-surface-600">
                          อัปเดตข้อมูล {bulkPreparationPopup.itemCount.toLocaleString('th-TH')} รายการ ลง `log_act_detail` เรียบร้อยแล้ว
                        </p>
                        <div className="mt-4 rounded-2xl border border-[#d9e7f2] bg-white/90 px-4 py-3 shadow-sm">
                          <span className="text-xs text-surface-500">หน้าต่างนี้จะปิดอัตโนมัติใน </span>
                          <span className="countdown text-sm">{bulkPreparationPopup.countdown}</span>
                          <span className="text-xs text-surface-500"> วินาที</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {isPreparationMode && selectedRow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={closePreparationForm} />
            <div className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-card-lg animate-slide-up">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">เตรียมข้อมูล Carbon Footprint</h3>
                  <p className="mt-1 text-xs text-surface-500">{selectedRow.resourceItemName} · {selectedRow.campLabel} · {selectedRow.landLabel}</p>
                </div>
                <button type="button" className="btn-icon btn-ghost" onClick={closePreparationForm}>
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={submitPreparation} className="space-y-5">
                <section className="rounded-xl border border-[#d9e7f2] bg-[#f8fbff] p-4">
                  <h4 className="mb-3 text-sm font-semibold">ข้อมูลเดิม</h4>
                  <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-4">
                    <div><span className="text-surface-500">จำนวน</span><strong className="block">{formatNumber(sourceQuantity)}</strong></div>
                    <div><span className="text-surface-500">ปริมาณรวมเดิม</span><strong className="block">{formatNumber(sourceVolume)}</strong></div>
                    <div><span className="text-surface-500">หน่วยเดิม</span><strong className="block">{selectedRow.sourceUnitLabel}</strong></div>
                    <div><span className="text-surface-500">พื้นที่ทำงาน</span><strong className="block">{formatNumber(selectedRow.original.log_activities_detail?.log_act_detail_areawork, 2)} ไร่</strong></div>
                  </div>
                </section>

                <section className="rounded-xl border border-[#d9e7f2] p-4">
                  <h4 className="mb-3 text-sm font-semibold">แปลงหน่วย</h4>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <label className="label">Prefix หน่วย</label>
                      <select className="select" value={form.preparedUnitPrefixId} onChange={(event) => setFormValue('preparedUnitPrefixId', event.target.value)}>
                        <option value="">— ไม่ระบุ —</option>
                        {unitPrefixes.map((prefix) => <option key={prefix.unit_prefix_id} value={prefix.unit_prefix_id}>{prefixLabel(prefix)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">หน่วยหลังเตรียม</label>
                      <select className="select" value={form.preparedUnitId} onChange={(event) => setFormValue('preparedUnitId', event.target.value)}>
                        <option value="">— ไม่ระบุ —</option>
                        {units.map((unit) => <option key={unit.unit_id} value={unit.unit_id}>{unitLabel(unit)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">ชื่อหน่วยใหม่</label>
                      <input
                        className="input"
                        value={form.preparedUnitName}
                        onChange={(event) => setFormValue('preparedUnitName', event.target.value)}
                        disabled={Boolean(form.preparedUnitId)}
                        placeholder="เช่น kg"
                      />
                    </div>
                    <div>
                      <label className="label">ตัวย่อหน่วยใหม่</label>
                      <input
                        className="input"
                        value={form.preparedUnitInitial}
                        onChange={(event) => setFormValue('preparedUnitInitial', event.target.value)}
                        disabled={Boolean(form.preparedUnitId)}
                        placeholder="เช่น kg"
                      />
                    </div>
                    <div>
                      <label className="label">ตัวคูณแปลงหน่วย</label>
                      <input type="number" step="0.000001" className="input" value={form.conversionFactor} onChange={(event) => setFormValue('conversionFactor', event.target.value)} />
                    </div>
                    <div>
                      <label className="label">ปริมาณรวมหลังเตรียม</label>
                      <input type="number" step="0.000001" className="input" value={form.preparedVolumeAll} onChange={(event) => setFormValue('preparedVolumeAll', event.target.value)} />
                    </div>
                  </div>
                </section>

                {selectedIsFertilizer && (
                  <section className="rounded-xl border border-[#d9e7f2] p-4">
                    <h4 className="mb-3 text-sm font-semibold">ปุ๋ย</h4>
                    <div className="mb-3 flex flex-wrap gap-2">
                      <button type="button" className="btn-secondary btn-sm" onClick={() => applyFertilizerBag(50)}>1 SCK = 50 kg</button>
                      <button type="button" className="btn-secondary btn-sm" onClick={() => applyFertilizerBag(30)}>1 SCK = 30 kg</button>
                      <button type="button" className="btn-ghost btn-sm" onClick={() => setFormValue('fertilizerPrepareType', 'organic')}>ปุ๋ยอินทรีย์</button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div>
                        <label className="label">ประเภทการเตรียม</label>
                        <select className="select" value={form.fertilizerPrepareType} onChange={(event) => setFormValue('fertilizerPrepareType', event.target.value)}>
                          <option value="chemical">ปุ๋ยเคมี</option>
                          <option value="organic">ปุ๋ยอินทรีย์</option>
                          <option value="other">อื่น ๆ</option>
                        </select>
                      </div>
                      <div><label className="label">น้ำหนักต่อกระสอบ (kg)</label><input type="number" step="0.001" className="input" value={form.fertilizerBagWeightKg} onChange={(event) => setFormValue('fertilizerBagWeightKg', event.target.value)} /></div>
                      <div><label className="label">N / Soil N</label><input type="number" step="0.001" className="input" value={form.soilN} onChange={(event) => setFormValue('soilN', event.target.value)} /></div>
                    </div>
                  </section>
                )}

                {selectedIsFuel && (
                  <section className="rounded-xl border border-[#d9e7f2] p-4">
                    <h4 className="mb-3 text-sm font-semibold">น้ำมัน</h4>
                    <div className="mb-3 flex flex-wrap gap-2">
                      <button type="button" className="btn-secondary btn-sm" onClick={applyFuelLiter} disabled={!canApplyFuelPresets}>เตรียมเป็น L</button>
                      <button type="button" className="btn-secondary btn-sm" onClick={applyFuelCubicMeter} disabled={!canApplyFuelPresets}>เตรียมเป็น m3</button>
                    </div>
                    <div className="rounded-xl border border-[#d9e7f2] bg-[#f8fbff] px-3 py-2 text-xs text-surface-600">
                      {canApplyFuelPresets
                        ? 'ใช้ factor พื้นฐาน 1 m3 = 1000 L และ 1 L = 0.001 m3 สำหรับเตรียมข้อมูลก่อนเข้าสูตร'
                        : 'ยังไม่พบหน่วยต้นทางที่ map กับ preset น้ำมันอัตโนมัติ ใช้การตั้งค่าในส่วนแปลงหน่วยด้านบนแทน'}
                    </div>
                  </section>
                )}

                {!selectedIsFertilizer && !selectedIsFuel && (
                  <section className="rounded-xl border border-[#d9e7f2] bg-[#f8fbff] p-4">
                    <h4 className="mb-3 text-sm font-semibold">ข้อมูลทั่วไป</h4>
                    <p className="text-sm text-surface-600">
                      รายการนี้ไม่มีสูตรเฉพาะแบบปุ๋ยหรือน้ำมันในรอบนี้ เราจะใช้การตั้งค่าในส่วนแปลงหน่วยด้านบน และบันทึกผลลง `log_act_detail` โดยตรง
                    </p>
                  </section>
                )}

                <section className="rounded-xl border border-[#d9e7f2] p-4">
                  <h4 className="mb-3 text-sm font-semibold">ตรวจดิน / SOC</h4>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <div><label className="label">วันที่ตรวจดิน</label><input type="date" className="input" value={form.soilSampleDate} onChange={(event) => setFormValue('soilSampleDate', event.target.value)} /></div>
                    <div><label className="label">SOC ปีฐาน</label><input type="number" step="0.001" className="input" value={form.soilSocBaseline} onChange={(event) => setFormValue('soilSocBaseline', event.target.value)} /></div>
                    <div><label className="label">SOC ปีโครงการ</label><input type="number" step="0.001" className="input" value={form.soilSocProject} onChange={(event) => setFormValue('soilSocProject', event.target.value)} /></div>
                    <div><label className="label">หมายเหตุ</label><input className="input" value={form.note} onChange={(event) => setFormValue('note', event.target.value)} /></div>
                  </div>
                </section>

                <section className="rounded-xl border border-[#d9e7f2] bg-[#f8fbff] p-4">
                  <h4 className="mb-3 text-sm font-semibold">ผลลัพธ์ที่จะบันทึก</h4>
                  <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-4">
                    <div><span className="text-surface-500">ประเภท</span><strong className="block">{getPreparationTypeLabel(form.fertilizerPrepareType)}</strong></div>
                    <div><span className="text-surface-500">หน่วยหลังเตรียม</span><strong className="block">{previewPreparedUnitLabel}</strong></div>
                    <div><span className="text-surface-500">ปริมาณหลังเตรียม</span><strong className="block">{formatNumber(previewPreparedVolume)}</strong></div>
                    <div><span className="text-surface-500">ผลต่างจากเดิม</span><strong className="block">{formatNumber(previewDiff)}</strong></div>
                  </div>
                </section>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="button" className="btn-secondary flex-1 justify-center" onClick={closePreparationForm}>ยกเลิก</button>
                  <button type="submit" className="btn-primary flex-1 justify-center" disabled={preparationMut.isPending}>
                    {preparationMut.isPending ? 'กำลังบันทึก...' : 'บันทึกการเตรียมข้อมูล'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isPreparationMode && statusPopup.kind !== 'hidden' && (
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
                    {' '}<span className="font-medium">กำลังเตรียมข้อมูล</span>{' '}เป็น{' '}
                    <span className="font-medium">พร้อมคำนวณมาตรฐาน</span>
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
                    {' '}<span className="font-medium">พร้อมคำนวณมาตรฐาน</span>{' '}เรียบร้อยแล้ว
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
    </>
  )

  if (embedded) return content

  return (
    <div className="cf-dash">
      <div className="page active">
        {content}
      </div>
    </div>
  )
}
