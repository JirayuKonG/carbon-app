import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ActivitySquare, CheckCircle2, CircleAlert, Clock3, Edit, Plus, Settings2, Trash2 } from 'lucide-react'
import { Column, DataTable } from '@/components/ui/DataTable'
import { DashboardVisibilityMenu, useDashboardVisibility } from '@/components/ui/DashboardVisibilityMenu'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DatabaseConnectionNotice } from '@/components/ui/DatabaseConnectionNotice'
import { getActivityCalStatusBadgeClass, getActivityCalStatusKind, getActivityCalStatusLabel } from '@/features/activities/cal-status'
import { del, get, post, put } from '@/lib/api'
import { formatBangkokDate } from '@/lib/datetime'

interface ActivityHeader {
  activities_header_id: number
  land_id: number
  act_header_type_id: number
  activities_header_idCode?: string
}

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
  act_productYear_id?: number
  act_header_type_id: number
  act_header_detail_type_id?: number
  act_header_detail_type_update_uid?: number
  act_equipment_id?: number
  act_fertilizer_id?: number
  act_chemiscal_id?: number
  act_resourceOther_id?: number
  resource_used_type_id: number
  unit_prefix_id?: number
  unit_id?: number
  log_act_detail_quatity: number
  log_act_detail_volumePerUnit: number
  log_act_detail_volumeAll: number
  log_act_detail_areawork: number
  log_act_detail_calStatus_id: number
  log_act_detail_create_at?: string
  activities_fertilizers?: { act_fertilizer_name?: string }
  activities_equipments?: { act_equipment_name?: string }
  activities_chemiscals?: { act_chemiscal_name?: string }
  activities_resourceOther?: { act_resourceOther_name?: string }
  activities_productYear?: { act_productYear_name?: string }
  resource_used_type?: { resc_used_type_name?: string }
  log_act_detail_calStatus?: { log_act_detail_calStatus_name?: string }
  activities_header?: DetailHeaderLocation
}

interface Land { land_id: number; land_code: string; name: string; land_camp_id?: number }
interface LandCamp { land_camp_id: number; land_camp_name: string }
interface HeaderType { act_header_type_id: number; act_header_type_name_th: string }
interface DetailType { act_header_detail_type_id: number; act_header_detail_type_name_th: string }
interface ResourceType { resource_used_type_id: number; resc_used_type_name: string }
interface CalStatus { log_act_detail_calStatus_id: number; log_act_detail_calStatus_name: string }
interface Fertilizer { act_fertilizer_id: number; act_fertilizer_name: string }
interface Equipment { act_equipment_id: number; act_equipment_name: string }
interface Chemical { act_chemiscal_id: number; act_chemiscal_name: string }
interface ResourceOther { act_resourceOther_id: number; act_resourceOther_name: string }
interface ProductYear { act_productYear_id: number; act_productYear_name?: string }
interface Unit { unit_id: number; unit_name?: string; unit_initial?: string }
interface UnitPrefix { unit_prefix_id: number; unit_prefix_name?: string; unit_prefix_initial?: string }

type DetailForm = {
  activities_header_id: string
  act_productYear_id: string
  act_header_type_id: string
  act_header_detail_type_id: string
  act_header_detail_type_update_uid: string
  act_equipment_id: string
  act_fertilizer_id: string
  act_chemiscal_id: string
  act_resourceOther_id: string
  resource_used_type_id: string
  unit_prefix_id: string
  unit_id: string
  log_act_detail_quatity: string
  log_act_detail_volumePerUnit: string
  log_act_detail_volumeAll: string
  log_act_detail_areawork: string
}

type DetailFilters = {
  productYearId: string
  activitiesHeaderId: string
  campId: string
  landId: string
  actHeaderTypeId: string
  actHeaderDetailTypeId: string
  resourceUsedTypeId: string
  calStatusId: string
}

interface ActivityLogRow {
  log_act_detail_id: number
  activityDateLabel: string
  productYearLabel: string
  headerLabel: string
  campName: string
  landLabel: string
  activityTypeName: string
  detailTypeName: string
  resourceTypeName: string
  resourceItemName: string
  unitLabel: string
  quantityLabel: string
  volumePerUnitLabel: string
  totalVolumeLabel: string
  workAreaLabel: string
  calStatusLabel: string
  original: LogDetail
}

const emptyDetailForm: DetailForm = {
  activities_header_id: '',
  act_productYear_id: '',
  act_header_type_id: '',
  act_header_detail_type_id: '',
  act_header_detail_type_update_uid: '',
  act_equipment_id: '',
  act_fertilizer_id: '',
  act_chemiscal_id: '',
  act_resourceOther_id: '',
  resource_used_type_id: '',
  unit_prefix_id: '',
  unit_id: '',
  log_act_detail_quatity: '',
  log_act_detail_volumePerUnit: '',
  log_act_detail_volumeAll: '',
  log_act_detail_areawork: '',
}

const emptyDetailFilters: DetailFilters = {
  productYearId: '',
  activitiesHeaderId: '',
  campId: '',
  landId: '',
  actHeaderTypeId: '',
  actHeaderDetailTypeId: '',
  resourceUsedTypeId: '',
  calStatusId: '',
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-surface-200 p-4">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-surface-500">{title}</h4>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {children}
      </div>
    </section>
  )
}

const CAMP_ONLY_LAND_LABEL = 'เบิกเข้าไร่'

function isPlaceholderLand(landCode?: string, landName?: string) {
  return landCode?.trim().toUpperCase().startsWith('AUTO-CAMP-')
    || landName?.trim().toUpperCase().startsWith('[AUTO-CAMP]')
}

function getLandDisplayLabel(landCode?: string, landName?: string) {
  if (isPlaceholderLand(landCode, landName)) return CAMP_ONLY_LAND_LABEL
  if (landCode && landName) return `${landCode} - ${landName}`
  return landCode ?? landName ?? '—'
}

function formatQuantityValue(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '—'
  const digits = Number.isInteger(value) ? 0 : 3
  return value.toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })
}

export function ActivityLogListPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [showForm, setShowForm] = useState(false)
  const [editingDetail, setEditingDetail] = useState<LogDetail | null>(null)
  const [deleteDetailTarget, setDeleteDetailTarget] = useState<LogDetail | null>(null)
  const [trackMethod, setTrackMethod] = useState<'direct' | 'cascade'>('cascade')
  const [selectedCampId, setSelectedCampId] = useState<number | null>(null)
  const [selectedLandId, setSelectedLandId] = useState<number | null>(null)
  const [detailForm, setDetailForm] = useState<DetailForm>(emptyDetailForm)
  const [detailFilters, setDetailFilters] = useState<DetailFilters>(emptyDetailFilters)

  const { data: headers = [], error: headersError } = useQuery({ queryKey: ['activity-headers'], queryFn: () => get<ActivityHeader[]>('/activities/headers') })
  const { data: details = [], isLoading: dLoad, error: detailsError } = useQuery({ queryKey: ['activity-details'], queryFn: () => get<LogDetail[]>('/activities/details') })
  const { data: lands = [], error: landsError } = useQuery({ queryKey: ['lands'], queryFn: () => get<Land[]>('/lands') })
  const { data: camps = [], error: campsError } = useQuery({ queryKey: ['camps'], queryFn: () => get<LandCamp[]>('/lands/camps') })
  const { data: hdrTypes = [], error: hdrTypesError } = useQuery({ queryKey: ['header-types'], queryFn: () => get<HeaderType[]>('/activities/header-types') })
  const { data: allDetailTypes = [], error: allDetailTypesError } = useQuery({ queryKey: ['detail-types-all'], queryFn: () => get<DetailType[]>('/activities/detail-types') })
  const { data: detailTypes = [] } = useQuery({
    queryKey: ['detail-types', detailForm.act_header_type_id],
    queryFn: () => get<DetailType[]>('/activities/detail-types', detailForm.act_header_type_id ? { header_type_id: Number(detailForm.act_header_type_id) } : undefined),
  })
  const { data: resTypes = [], error: resTypesError } = useQuery({ queryKey: ['resource-types'], queryFn: () => get<ResourceType[]>('/activities/resource-types') })
  const { data: calStatuses = [], error: calStatusesError } = useQuery({ queryKey: ['cal-statuses'], queryFn: () => get<CalStatus[]>('/activities/cal-statuses') })
  const { data: fertilizers = [], error: fertilizersError } = useQuery({ queryKey: ['fertilizers'], queryFn: () => get<Fertilizer[]>('/activities/fertilizers') })
  const { data: equipments = [], error: equipmentsError } = useQuery({ queryKey: ['equipments'], queryFn: () => get<Equipment[]>('/activities/equipments') })
  const { data: chemicals = [], error: chemicalsError } = useQuery({ queryKey: ['chemicals'], queryFn: () => get<Chemical[]>('/activities/chemicals') })
  const { data: resourceOthers = [], error: resourceOthersError } = useQuery({ queryKey: ['resource-others'], queryFn: () => get<ResourceOther[]>('/activities/resource-others') })
  const { data: productYears = [], error: productYearsError } = useQuery({ queryKey: ['activity-product-years'], queryFn: () => get<ProductYear[]>('/activities/product-years') })
  const { data: units = [], error: unitsError } = useQuery({ queryKey: ['units'], queryFn: () => get<Unit[]>('/emission-factors/units') })
  const { data: unitPrefixes = [], error: unitPrefixesError } = useQuery({ queryKey: ['unit-prefixs'], queryFn: () => get<UnitPrefix[]>('/emission-factors/unit-prefixs') })

  const activityQueryItems = [
    { label: 'หัวข้อกิจกรรม', error: headersError },
    { label: 'รายการบันทึกกิจกรรม', error: detailsError },
    { label: 'ข้อมูลแปลง', error: landsError },
    { label: 'ข้อมูลแคมป์', error: campsError },
    { label: 'ประเภทกิจกรรม', error: hdrTypesError },
    { label: 'รายละเอียดกิจกรรม', error: allDetailTypesError },
    { label: 'ประเภทปัจจัย', error: resTypesError },
    { label: 'สถานะการคำนวณ', error: calStatusesError },
    { label: 'ปุ๋ย', error: fertilizersError },
    { label: 'อุปกรณ์', error: equipmentsError },
    { label: 'สารเคมี', error: chemicalsError },
    { label: 'รายการอื่น ๆ', error: resourceOthersError },
    { label: 'ปีการผลิต', error: productYearsError },
    { label: 'หน่วยนับ', error: unitsError },
    { label: 'คำนำหน้าหน่วย', error: unitPrefixesError },
  ]

  const createDetailMut = useMutation({
    mutationFn: (payload: Record<string, number | string | undefined>) =>
      editingDetail
        ? put(`/activities/details/${editingDetail.log_act_detail_id}`, payload)
        : post('/activities/details', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activity-details'] })
      qc.invalidateQueries({ queryKey: ['activity-headers'] })
      setShowForm(false)
      setEditingDetail(null)
      setDetailForm(emptyDetailForm)
      setSelectedCampId(null)
      setSelectedLandId(null)
    },
  })

  const deleteDetailMut = useMutation({
    mutationFn: (id: number) => del(`/activities/details/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activity-details'] })
      qc.invalidateQueries({ queryKey: ['activity-headers'] })
      setDeleteDetailTarget(null)
    },
  })

  const landMap = Object.fromEntries(lands.map((land) => [land.land_id, land.land_code]))
  const campMap = Object.fromEntries(camps.map((camp) => [camp.land_camp_id, camp.land_camp_name]))
  const headerMap = Object.fromEntries(headers.map((header) => [header.activities_header_id, header.activities_header_idCode ?? `#${header.activities_header_id}`]))
  const hdrTypeMap = Object.fromEntries(hdrTypes.map((type) => [type.act_header_type_id, type.act_header_type_name_th]))
  const detailTypeMap = Object.fromEntries(allDetailTypes.map((type) => [type.act_header_detail_type_id, type.act_header_detail_type_name_th]))
  const resourceTypeMap = Object.fromEntries(resTypes.map((type) => [type.resource_used_type_id, type.resc_used_type_name]))
  const fertilizerMap = Object.fromEntries(fertilizers.map((item) => [item.act_fertilizer_id, item.act_fertilizer_name]))
  const equipmentMap = Object.fromEntries(equipments.map((item) => [item.act_equipment_id, item.act_equipment_name]))
  const chemicalMap = Object.fromEntries(chemicals.map((item) => [item.act_chemiscal_id, item.act_chemiscal_name]))
  const resourceOtherMap = Object.fromEntries(resourceOthers.map((item) => [item.act_resourceOther_id, item.act_resourceOther_name]))
  const productYearMap = Object.fromEntries(productYears.map((year) => [year.act_productYear_id, year.act_productYear_name ?? `#${year.act_productYear_id}`]))
  const unitMap = Object.fromEntries(units.map((unit) => [unit.unit_id, unit.unit_name ?? unit.unit_initial ?? `#${unit.unit_id}`]))
  const unitPrefixMap = Object.fromEntries(unitPrefixes.map((prefix) => [prefix.unit_prefix_id, prefix.unit_prefix_name ?? prefix.unit_prefix_initial ?? `#${prefix.unit_prefix_id}`]))

  const getDetailCampId = (detail: LogDetail) => detail.activities_header?.lands?.land_camp_id
  const getDetailCampName = (detail: LogDetail) =>
    detail.activities_header?.lands?.lands_camps?.land_camp_name
    ?? (getDetailCampId(detail) != null ? campMap[getDetailCampId(detail) ?? 0] : undefined)

  const getDetailLandId = (detail: LogDetail) => detail.activities_header?.land_id
  const getLandLabelById = (landId?: number) => {
    if (landId == null) return '—'
    const land = lands.find((item) => item.land_id === landId)
    if (land) return getLandDisplayLabel(land.land_code, land.name)
    return landMap[landId] ?? `#${landId}`
  }
  const getDetailLandLabel = (detail: LogDetail) => {
    const landCode = detail.activities_header?.lands?.land_code
      ?? (getDetailLandId(detail) != null ? landMap[getDetailLandId(detail) ?? 0] : undefined)
    const landName = detail.activities_header?.lands?.name

    return getLandDisplayLabel(landCode, landName)
  }
  const getDetailProductYearLabel = (detail: LogDetail) =>
    detail.activities_productYear?.act_productYear_name
    ?? productYearMap[detail.act_productYear_id ?? 0]
    ?? '—'

  const formatNumber = (value?: number, digits = 0) => {
    if (value == null || Number.isNaN(value)) return '—'
    return value.toLocaleString('th-TH', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
  }

  const getResourceItemName = (detail: LogDetail) =>
    detail.activities_fertilizers?.act_fertilizer_name
    ?? detail.activities_equipments?.act_equipment_name
    ?? detail.activities_chemiscals?.act_chemiscal_name
    ?? detail.activities_resourceOther?.act_resourceOther_name
    ?? fertilizerMap[detail.act_fertilizer_id ?? 0]
    ?? equipmentMap[detail.act_equipment_id ?? 0]
    ?? chemicalMap[detail.act_chemiscal_id ?? 0]
    ?? resourceOtherMap[detail.act_resourceOther_id ?? 0]
    ?? '—'

  const getUnitLabel = (detail: LogDetail) => {
    const prefix = unitPrefixMap[detail.unit_prefix_id ?? 0]
    const unit = unitMap[detail.unit_id ?? 0]
    if (prefix && unit) return `${prefix} ${unit}`
    return prefix ?? unit ?? '—'
  }

  const filteredDetails = details.filter((detail) =>
    (!detailFilters.productYearId || detail.act_productYear_id === Number(detailFilters.productYearId))
    && (!detailFilters.activitiesHeaderId || detail.activities_header_id === Number(detailFilters.activitiesHeaderId))
    && (!detailFilters.campId || getDetailCampId(detail) === Number(detailFilters.campId))
    && (!detailFilters.landId || getDetailLandId(detail) === Number(detailFilters.landId))
    && (!detailFilters.actHeaderTypeId || detail.act_header_type_id === Number(detailFilters.actHeaderTypeId))
    && (!detailFilters.actHeaderDetailTypeId || detail.act_header_detail_type_id === Number(detailFilters.actHeaderDetailTypeId))
    && (!detailFilters.resourceUsedTypeId || detail.resource_used_type_id === Number(detailFilters.resourceUsedTypeId))
    && (!detailFilters.calStatusId || detail.log_act_detail_calStatus_id === Number(detailFilters.calStatusId))
  )

  const rows: ActivityLogRow[] = filteredDetails.map((detail) => ({
    log_act_detail_id: detail.log_act_detail_id,
    activityDateLabel: formatBangkokDate(detail.log_act_detail_create_at ?? detail.activities_header?.activities_header_startDate),
    productYearLabel: getDetailProductYearLabel(detail),
    headerLabel: detail.activities_header?.activities_header_idCode ?? headerMap[detail.activities_header_id ?? 0] ?? (detail.activities_header_id != null ? `#${detail.activities_header_id}` : '—'),
    campName: getDetailCampName(detail) ?? '—',
    landLabel: getDetailLandLabel(detail),
    activityTypeName: hdrTypeMap[detail.act_header_type_id] ?? String(detail.act_header_type_id ?? '—'),
    detailTypeName: detailTypeMap[detail.act_header_detail_type_id ?? 0] ?? (detail.act_header_detail_type_id != null ? String(detail.act_header_detail_type_id) : '—'),
    resourceTypeName: detail.resource_used_type?.resc_used_type_name ?? resourceTypeMap[detail.resource_used_type_id] ?? String(detail.resource_used_type_id ?? '—'),
    resourceItemName: getResourceItemName(detail),
    unitLabel: getUnitLabel(detail),
    quantityLabel: formatQuantityValue(detail.log_act_detail_quatity),
    volumePerUnitLabel: formatNumber(detail.log_act_detail_volumePerUnit, 3),
    totalVolumeLabel: formatNumber(detail.log_act_detail_volumeAll, 3),
    workAreaLabel: formatNumber(detail.log_act_detail_areawork, 2),
    calStatusLabel: detail.log_act_detail_calStatus?.log_act_detail_calStatus_name ?? (calStatuses.find((status) => status.log_act_detail_calStatus_id === detail.log_act_detail_calStatus_id)?.log_act_detail_calStatus_name ?? '—'),
    original: detail,
  }))

  const visibleLands = selectedCampId ? lands.filter((land) => land.land_camp_id === selectedCampId) : lands
  const visibleDetailFilterLands = detailFilters.campId
    ? lands.filter((land) => land.land_camp_id === Number(detailFilters.campId))
    : lands
  const visibleHeaders = selectedLandId ? headers.filter((header) => header.land_id === selectedLandId) : headers

  const setFormValue = (key: keyof DetailForm, value: string) => {
    setDetailForm((prev) => ({ ...prev, [key]: value }))
  }

  const setDetailFilterValue = (key: keyof DetailFilters, value: string) => {
    setDetailFilters((prev) => {
      if (key === 'campId') {
        return {
          ...prev,
          campId: value,
          landId: '',
        }
      }

      return { ...prev, [key]: value }
    })
  }

  useEffect(() => {
    const landId = searchParams.get('land_id') ?? ''
    const campId = searchParams.get('camp_id') ?? ''

    setDetailFilters((prev) => ({
      ...prev,
      landId,
      campId,
    }))
  }, [searchParams])

  useEffect(() => {
    if (!detailFilters.landId) return

    const selectedLand = lands.find((land) => land.land_id === Number(detailFilters.landId))
    const selectedCamp = detailFilters.campId ? Number(detailFilters.campId) : null

    if (selectedCamp != null && selectedLand?.land_camp_id !== selectedCamp) {
      setDetailFilters((prev) => ({ ...prev, landId: '' }))
    }
  }, [detailFilters.campId, detailFilters.landId, lands])

  const setLandFilter = (landId: number | null) => {
    setSelectedLandId(landId)
    setFormValue('activities_header_id', '')
  }

  const openDetailForm = (header?: ActivityHeader) => {
    const selectedLand = header ? lands.find((land) => land.land_id === header.land_id) : undefined
    setEditingDetail(null)
    setDetailForm({
      ...emptyDetailForm,
      activities_header_id: header ? String(header.activities_header_id) : '',
      act_header_type_id: header?.act_header_type_id ? String(header.act_header_type_id) : '',
    })
    setSelectedLandId(header?.land_id ?? null)
    setSelectedCampId(selectedLand?.land_camp_id ?? null)
    setShowForm(true)
  }

  const openEditDetailForm = (detail: LogDetail) => {
    const header = headers.find((item) => item.activities_header_id === detail.activities_header_id)
    const selectedLand = header ? lands.find((land) => land.land_id === header.land_id) : undefined

    setEditingDetail(detail)
    setSelectedCampId(selectedLand?.land_camp_id ?? null)
    setSelectedLandId(header?.land_id ?? null)
    setDetailForm({
      activities_header_id: detail.activities_header_id ? String(detail.activities_header_id) : '',
      act_productYear_id: detail.act_productYear_id ? String(detail.act_productYear_id) : '',
      act_header_type_id: detail.act_header_type_id ? String(detail.act_header_type_id) : '',
      act_header_detail_type_id: detail.act_header_detail_type_id ? String(detail.act_header_detail_type_id) : '',
      act_header_detail_type_update_uid: detail.act_header_detail_type_update_uid ? String(detail.act_header_detail_type_update_uid) : '',
      act_equipment_id: detail.act_equipment_id ? String(detail.act_equipment_id) : '',
      act_fertilizer_id: detail.act_fertilizer_id ? String(detail.act_fertilizer_id) : '',
      act_chemiscal_id: detail.act_chemiscal_id ? String(detail.act_chemiscal_id) : '',
      act_resourceOther_id: detail.act_resourceOther_id ? String(detail.act_resourceOther_id) : '',
      resource_used_type_id: detail.resource_used_type_id ? String(detail.resource_used_type_id) : '',
      unit_prefix_id: detail.unit_prefix_id ? String(detail.unit_prefix_id) : '',
      unit_id: detail.unit_id ? String(detail.unit_id) : '',
      log_act_detail_quatity: detail.log_act_detail_quatity != null ? String(detail.log_act_detail_quatity) : '',
      log_act_detail_volumePerUnit: detail.log_act_detail_volumePerUnit != null ? String(detail.log_act_detail_volumePerUnit) : '',
      log_act_detail_volumeAll: detail.log_act_detail_volumeAll != null ? String(detail.log_act_detail_volumeAll) : '',
      log_act_detail_areawork: detail.log_act_detail_areawork != null ? String(detail.log_act_detail_areawork) : '',
    })
    setShowForm(true)
  }

  const closeDetailForm = () => {
    setShowForm(false)
    setEditingDetail(null)
    setDetailForm(emptyDetailForm)
    setSelectedCampId(null)
    setSelectedLandId(null)
  }

  const toNumberOrUndefined = (value: string) => (value === '' ? undefined : Number(value))

  const submitDetailForm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    createDetailMut.mutate({
      activities_header_id: toNumberOrUndefined(detailForm.activities_header_id),
      act_productYear_id: toNumberOrUndefined(detailForm.act_productYear_id),
      act_header_type_id: toNumberOrUndefined(detailForm.act_header_type_id),
      act_header_detail_type_id: toNumberOrUndefined(detailForm.act_header_detail_type_id),
      act_header_detail_type_update_uid: toNumberOrUndefined(detailForm.act_header_detail_type_update_uid),
      act_equipment_id: toNumberOrUndefined(detailForm.act_equipment_id),
      act_fertilizer_id: toNumberOrUndefined(detailForm.act_fertilizer_id),
      act_chemiscal_id: toNumberOrUndefined(detailForm.act_chemiscal_id),
      act_resourceOther_id: toNumberOrUndefined(detailForm.act_resourceOther_id),
      resource_used_type_id: toNumberOrUndefined(detailForm.resource_used_type_id),
      unit_prefix_id: toNumberOrUndefined(detailForm.unit_prefix_id),
      unit_id: toNumberOrUndefined(detailForm.unit_id),
      log_act_detail_quatity: toNumberOrUndefined(detailForm.log_act_detail_quatity),
      log_act_detail_volumePerUnit: toNumberOrUndefined(detailForm.log_act_detail_volumePerUnit),
      log_act_detail_volumeAll: toNumberOrUndefined(detailForm.log_act_detail_volumeAll),
      log_act_detail_areawork: toNumberOrUndefined(detailForm.log_act_detail_areawork),
    })
  }

  const renderCalStatus = (detail: LogDetail, label: string) => {
    const statusText = getActivityCalStatusLabel(label, detail.log_act_detail_calStatus_id)
    return <span className={getActivityCalStatusBadgeClass(label, detail.log_act_detail_calStatus_id)}>{statusText}</span>
  }

  const columns: Column<ActivityLogRow>[] = [
    { key: 'log_act_detail_id', header: 'ID', width: '60px', sortable: true },
    {
      key: 'activityDateLabel',
      header: 'วันที่ปฏิบัติ',
      width: '110px',
      sortable: true,
      sortValue: (row) => row.original.log_act_detail_create_at ?? row.original.activities_header?.activities_header_startDate ?? '',
    },
    { key: 'headerLabel', header: 'หัวข้อกิจกรรม', sortable: true, render: (row) => <span className="badge-cyan">{row.headerLabel}</span> },
    { key: 'productYearLabel', header: 'ปีการผลิต', sortable: true },
    { key: 'campName', header: 'แคมป์', sortable: true, render: (row) => row.campName !== '—' ? <span className="badge-blue">{row.campName}</span> : '—' },
    { key: 'landLabel', header: 'แปลง', sortable: true, render: (row) => row.landLabel !== '—' ? <span className="badge-green">{row.landLabel}</span> : '—' },
    { key: 'activityTypeName', header: 'กิจกรรม', sortable: true },
    { key: 'detailTypeName', header: 'รายละเอียด', sortable: true },
    { key: 'resourceTypeName', header: 'ประเภทปัจจัย', sortable: true },
    { key: 'resourceItemName', header: 'รายการปัจจัย', sortable: true },
    { key: 'unitLabel', header: 'หน่วย', sortable: true },
    { key: 'quantityLabel', header: 'จำนวน', sortable: true },
    { key: 'volumePerUnitLabel', header: 'ปริมาณ/หน่วย', sortable: true },
    { key: 'totalVolumeLabel', header: 'ปริมาณรวม', sortable: true, render: (row) => <span className="font-mono">{row.totalVolumeLabel}</span> },
    { key: 'workAreaLabel', header: 'พื้นที่ (ไร่)', sortable: true },
    { key: 'calStatusLabel', header: 'สถานะ CO₂e', sortable: true, render: (row) => renderCalStatus(row.original, row.calStatusLabel) },
  ]

  const importedCount = details.filter((detail) => getActivityCalStatusKind(detail.log_act_detail_calStatus?.log_act_detail_calStatus_name, detail.log_act_detail_calStatus_id) === 'imported').length
  const preparingCount = details.filter((detail) => getActivityCalStatusKind(detail.log_act_detail_calStatus?.log_act_detail_calStatus_name, detail.log_act_detail_calStatus_id) === 'preparing').length
  const readyCount = details.filter((detail) => getActivityCalStatusKind(detail.log_act_detail_calStatus?.log_act_detail_calStatus_name, detail.log_act_detail_calStatus_id) === 'ready').length
  const standardDoneCount = details.filter((detail) => getActivityCalStatusKind(detail.log_act_detail_calStatus?.log_act_detail_calStatus_name, detail.log_act_detail_calStatus_id) === 'standardDone').length
  const standardCfpDoneCount = details.filter((detail) => getActivityCalStatusKind(detail.log_act_detail_calStatus?.log_act_detail_calStatus_name, detail.log_act_detail_calStatus_id) === 'cfpDone').length
  const errorCount = details.filter((detail) => getActivityCalStatusKind(detail.log_act_detail_calStatus?.log_act_detail_calStatus_name, detail.log_act_detail_calStatus_id) === 'error').length

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
    'activity-log-dashboard-cards',
    dashboardOptions.map((option) => option.key),
    dashboardOptions,
  )

  const dashboardCards = [
    {
      key: 'total',
      label: 'รายการทั้งหมด',
      icon: <ActivitySquare size={14} className="text-primary-500" />,
      value: details.length,
      valueClassName: 'stat-value',
    },
    {
      key: 'imported',
      label: 'นำเข้าข้อมูลแล้ว',
      icon: <Plus size={14} className="text-surface-500" />,
      value: importedCount,
      valueClassName: 'stat-value text-surface-700',
    },
    {
      key: 'preparing',
      label: 'กำลังเตรียมข้อมูล',
      icon: <Edit size={14} className="text-blue-500" />,
      value: preparingCount,
      valueClassName: 'stat-value text-blue-700',
    },
    {
      key: 'ready',
      label: 'พร้อมคำนวณมาตรฐาน',
      icon: <Clock3 size={14} className="text-accent-500" />,
      value: readyCount,
      valueClassName: 'stat-value text-accent-600',
    },
    {
      key: 'standardDone',
      label: 'คำนวณแล้ว(มาตรฐาน)',
      icon: <CheckCircle2 size={14} className="text-primary-500" />,
      value: standardDoneCount,
      valueClassName: 'stat-value text-primary-700',
    },
    {
      key: 'cfpDone',
      label: 'คำนวณแล้ว(มาตรฐาน,C-credit)',
      icon: <CheckCircle2 size={14} className="text-cyan-600" />,
      value: standardCfpDoneCount,
      valueClassName: 'stat-value text-cyan-700',
    },
    {
      key: 'error',
      label: 'คำนวณผิดพลาด',
      icon: <CircleAlert size={14} className="text-red-500" />,
      value: errorCount,
      valueClassName: 'stat-value text-red-700',
    },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><ActivitySquare size={20} className="text-primary-600" /> รายการบันทึกกิจกรรม</h1>
          <p className="page-subtitle">มุมมองใช้งานง่ายสำหรับรายการบันทึกกิจกรรม พร้อมค้นหา กรอง และจัดการรายการ</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => navigate('/activities/manage')}>
            <Settings2 size={14} /> จัดการขั้นสูง
          </button>
          <button className="btn-primary" onClick={() => openDetailForm()}>
            <Plus size={14} /> เพิ่มรายการ
          </button>
        </div>
      </div>

      <div className="mb-6">
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
          />
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
          {dashboardCards
            .filter((card) => visibleDashboardKeySet.has(card.key))
            .map((card) => (
              <div key={card.key} className="stat-card">
                <div className="flex items-center gap-2">
                  {card.icon}
                  <span className="stat-label">{card.label}</span>
                </div>
                <p className={card.valueClassName}>{card.value}</p>
              </div>
            ))}
        </div>
      </div>

      <DatabaseConnectionNotice
        items={activityQueryItems}
        className="mb-4"
        onRetry={() => { void qc.refetchQueries({ type: 'active' }) }}
      />

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">ตารางรายการบันทึกกิจกรรม</h2>
          <button className="btn-ghost btn-sm" onClick={() => setDetailFilters(emptyDetailFilters)}>
            ล้างตัวกรอง
          </button>
        </div>

        <div className="mb-4 rounded-lg border border-surface-200 p-3">
          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-8">
            <div>
              <label className="label">ปีการผลิต</label>
              <select className="select" value={detailFilters.productYearId} onChange={(e) => setDetailFilterValue('productYearId', e.target.value)}>
                <option value="">ทั้งหมด</option>
                {productYears.map((year) => (
                  <option key={year.act_productYear_id} value={year.act_productYear_id}>
                    {year.act_productYear_name ?? `#${year.act_productYear_id}`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">หัวข้อกิจกรรม</label>
              <select className="select" value={detailFilters.activitiesHeaderId} onChange={(e) => setDetailFilterValue('activitiesHeaderId', e.target.value)}>
                <option value="">ทั้งหมด</option>
                {headers.map((header) => (
                  <option key={header.activities_header_id} value={header.activities_header_id}>
                    #{header.activities_header_id} {header.activities_header_idCode ?? ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">แคมป์</label>
              <select className="select" value={detailFilters.campId} onChange={(e) => setDetailFilterValue('campId', e.target.value)}>
                <option value="">ทั้งหมด</option>
                {camps.map((camp) => <option key={camp.land_camp_id} value={camp.land_camp_id}>{camp.land_camp_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">แปลง</label>
              <select className="select" value={detailFilters.landId} onChange={(e) => setDetailFilterValue('landId', e.target.value)}>
                <option value="">ทั้งหมด</option>
                {visibleDetailFilterLands.map((land) => <option key={land.land_id} value={land.land_id}>{getLandDisplayLabel(land.land_code, land.name)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">ประเภทกิจกรรม</label>
              <select className="select" value={detailFilters.actHeaderTypeId} onChange={(e) => setDetailFilterValue('actHeaderTypeId', e.target.value)}>
                <option value="">ทั้งหมด</option>
                {hdrTypes.map((type) => <option key={type.act_header_type_id} value={type.act_header_type_id}>{type.act_header_type_name_th}</option>)}
              </select>
            </div>
            <div>
              <label className="label">ประเภทรายละเอียด</label>
              <select className="select" value={detailFilters.actHeaderDetailTypeId} onChange={(e) => setDetailFilterValue('actHeaderDetailTypeId', e.target.value)}>
                <option value="">ทั้งหมด</option>
                {allDetailTypes.map((type) => <option key={type.act_header_detail_type_id} value={type.act_header_detail_type_id}>{type.act_header_detail_type_name_th}</option>)}
              </select>
            </div>
            <div>
              <label className="label">ประเภทปัจจัย</label>
              <select className="select" value={detailFilters.resourceUsedTypeId} onChange={(e) => setDetailFilterValue('resourceUsedTypeId', e.target.value)}>
                <option value="">ทั้งหมด</option>
                {resTypes.map((type) => <option key={type.resource_used_type_id} value={type.resource_used_type_id}>{type.resc_used_type_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">สถานะคำนวณ</label>
              <select className="select" value={detailFilters.calStatusId} onChange={(e) => setDetailFilterValue('calStatusId', e.target.value)}>
                <option value="">ทั้งหมด</option>
                {calStatuses.map((status) => <option key={status.log_act_detail_calStatus_id} value={status.log_act_detail_calStatus_id}>{status.log_act_detail_calStatus_name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <DataTable
          data={rows}
          columns={columns}
          isLoading={dLoad}
          rowKey={(row) => row.log_act_detail_id}
          searchPlaceholder="ค้นหา header, แคมป์, แปลง, รายการปัจจัย..."
          defaultPageSize={10}
          emptyMessage="ยังไม่มีรายการบันทึกกิจกรรม"
          actions={(row) => (
            <div className="flex items-center justify-end gap-1">
              <button className="btn-secondary btn-sm" onClick={() => openEditDetailForm(row.original)}>
                <Edit size={13} />
              </button>
              <button className="btn-danger btn-sm" onClick={() => setDeleteDetailTarget(row.original)}>
                <Trash2 size={13} />
              </button>
            </div>
          )}
        />
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeDetailForm} />
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-card-lg animate-slide-up">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="mb-2 font-semibold">{editingDetail ? 'แก้ไขบันทึกกิจกรรม' : 'เพิ่มบันทึกกิจกรรม'}</h3>
                <p className="text-xs text-surface-500">กรอกข้อมูลรายการบันทึกกิจกรรมในหน้านี้ก่อน แล้วค่อยย้ายสถานะและคำนวณจากเมนูคำนวณ Carbon</p>
              </div>
              <div className="min-w-40">
                <label className="label">การคำนวณ</label>
                <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-xs text-surface-600">
                  ใช้เมนู <span className="font-medium text-primary-700">คำนวณ Carbon</span> สำหรับคำนวณมาตรฐานและ C-credit
                </div>
              </div>
            </div>

            <form onSubmit={submitDetailForm} className="space-y-4">
              <FormSection title="หัวข้อกิจกรรมและแปลง">
                <div className="md:col-span-2">
                  <label className="label">วิธีเลือกแปลง</label>
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTrackMethod('direct')}
                      className={`rounded-lg border py-1.5 text-xs font-medium ${trackMethod === 'direct' ? 'border-primary-600 bg-primary-600 text-white' : 'border-surface-200 bg-white text-surface-600'}`}
                    >
                      ระบุ Land ID โดยตรง
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrackMethod('cascade')}
                      className={`rounded-lg border py-1.5 text-xs font-medium ${trackMethod === 'cascade' ? 'border-primary-600 bg-primary-600 text-white' : 'border-surface-200 bg-white text-surface-600'}`}
                    >
                      เลือกจากแคมป์ → แปลง
                    </button>
                  </div>

                  {trackMethod === 'direct' ? (
                    <select className="select" value={selectedLandId ?? ''} onChange={(e) => setLandFilter(e.target.value ? Number(e.target.value) : null)}>
                      <option value="">— เลือกแปลง —</option>
                      {lands.map((land) => <option key={land.land_id} value={land.land_id}>{getLandDisplayLabel(land.land_code, land.name)}</option>)}
                    </select>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        className="select"
                        value={selectedCampId ?? ''}
                        onChange={(e) => {
                          const campId = e.target.value ? Number(e.target.value) : null
                          setSelectedCampId(campId)
                          setLandFilter(null)
                        }}
                      >
                        <option value="">— แคมป์ —</option>
                        {camps.map((camp) => <option key={camp.land_camp_id} value={camp.land_camp_id}>{camp.land_camp_name}</option>)}
                      </select>
                      <select className="select" value={selectedLandId ?? ''} onChange={(e) => setLandFilter(e.target.value ? Number(e.target.value) : null)}>
                        <option value="">— แปลง —</option>
                        {visibleLands.map((land) => <option key={land.land_id} value={land.land_id}>{getLandDisplayLabel(land.land_code, land.name)}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="label">ปีการผลิต</label>
                  <select className="select" value={detailForm.act_productYear_id} onChange={(e) => setFormValue('act_productYear_id', e.target.value)}>
                    <option value="">— ไม่ระบุ —</option>
                    {productYears.map((year) => (
                      <option key={year.act_productYear_id} value={year.act_productYear_id}>
                        {year.act_productYear_name ?? `#${year.act_productYear_id}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="label">หัวข้อกิจกรรม</label>
                  <select
                    className="select"
                    value={detailForm.activities_header_id}
                    onChange={(e) => {
                      const header = headers.find((item) => item.activities_header_id === Number(e.target.value))
                      setFormValue('activities_header_id', e.target.value)
                      if (header?.act_header_type_id) setFormValue('act_header_type_id', String(header.act_header_type_id))
                    }}
                  >
                    <option value="">— เลือกหัวข้อกิจกรรม —</option>
                    {visibleHeaders.map((header) => (
                      <option key={header.activities_header_id} value={header.activities_header_id}>
                        #{header.activities_header_id} {header.activities_header_idCode ?? ''} - {getLandLabelById(header.land_id)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">ประเภทกิจกรรม *</label>
                  <select
                    className="select"
                    value={detailForm.act_header_type_id}
                    onChange={(e) => {
                      setFormValue('act_header_type_id', e.target.value)
                      setFormValue('act_header_detail_type_id', '')
                    }}
                  >
                    <option value="">— เลือกประเภทกิจกรรม —</option>
                    {hdrTypes.map((type) => <option key={type.act_header_type_id} value={type.act_header_type_id}>{type.act_header_type_name_th}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">ประเภทรายละเอียด</label>
                  <select className="select" value={detailForm.act_header_detail_type_id} onChange={(e) => setFormValue('act_header_detail_type_id', e.target.value)}>
                    <option value="">— ไม่ระบุ —</option>
                    {detailTypes.map((type) => <option key={type.act_header_detail_type_id} value={type.act_header_detail_type_id}>{type.act_header_detail_type_name_th}</option>)}
                  </select>
                </div>
              </FormSection>

              <FormSection title="ปัจจัยการผลิต">
                <div>
                  <label className="label">ประเภทปัจจัย *</label>
                  <select className="select" value={detailForm.resource_used_type_id} onChange={(e) => setFormValue('resource_used_type_id', e.target.value)}>
                    <option value="">— เลือกประเภทปัจจัย —</option>
                    {resTypes.map((type) => <option key={type.resource_used_type_id} value={type.resource_used_type_id}>{type.resc_used_type_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">ปุ๋ย</label>
                  <select
                    className="select"
                    value={detailForm.act_fertilizer_id}
                    onChange={(e) => {
                      setFormValue('act_fertilizer_id', e.target.value)
                      if (e.target.value) {
                        setFormValue('act_equipment_id', '')
                        setFormValue('act_chemiscal_id', '')
                        setFormValue('act_resourceOther_id', '')
                      }
                    }}
                  >
                    <option value="">— ไม่ระบุ —</option>
                    {fertilizers.map((item) => <option key={item.act_fertilizer_id} value={item.act_fertilizer_id}>{item.act_fertilizer_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">อุปกรณ์</label>
                  <select
                    className="select"
                    value={detailForm.act_equipment_id}
                    onChange={(e) => {
                      setFormValue('act_equipment_id', e.target.value)
                      if (e.target.value) {
                        setFormValue('act_fertilizer_id', '')
                        setFormValue('act_chemiscal_id', '')
                        setFormValue('act_resourceOther_id', '')
                      }
                    }}
                  >
                    <option value="">— ไม่ระบุ —</option>
                    {equipments.map((item) => <option key={item.act_equipment_id} value={item.act_equipment_id}>{item.act_equipment_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">สารเคมี</label>
                  <select
                    className="select"
                    value={detailForm.act_chemiscal_id}
                    onChange={(e) => {
                      setFormValue('act_chemiscal_id', e.target.value)
                      if (e.target.value) {
                        setFormValue('act_fertilizer_id', '')
                        setFormValue('act_equipment_id', '')
                        setFormValue('act_resourceOther_id', '')
                      }
                    }}
                  >
                    <option value="">— ไม่ระบุ —</option>
                    {chemicals.map((item) => <option key={item.act_chemiscal_id} value={item.act_chemiscal_id}>{item.act_chemiscal_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">รายการอื่น ๆ</label>
                  <select
                    className="select"
                    value={detailForm.act_resourceOther_id}
                    onChange={(e) => {
                      setFormValue('act_resourceOther_id', e.target.value)
                      if (e.target.value) {
                        setFormValue('act_fertilizer_id', '')
                        setFormValue('act_equipment_id', '')
                        setFormValue('act_chemiscal_id', '')
                      }
                    }}
                  >
                    <option value="">— ไม่ระบุ —</option>
                    {resourceOthers.map((item) => <option key={item.act_resourceOther_id} value={item.act_resourceOther_id}>{item.act_resourceOther_name}</option>)}
                  </select>
                </div>
              </FormSection>

              <FormSection title="หน่วยและปริมาณ">
                <div>
                  <label className="label">Prefix หน่วย</label>
                  <select className="select" value={detailForm.unit_prefix_id} onChange={(e) => setFormValue('unit_prefix_id', e.target.value)}>
                    <option value="">— ไม่ระบุ —</option>
                    {unitPrefixes.map((prefix) => <option key={prefix.unit_prefix_id} value={prefix.unit_prefix_id}>{prefix.unit_prefix_name ?? prefix.unit_prefix_initial ?? `#${prefix.unit_prefix_id}`}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">หน่วยนับ</label>
                  <select className="select" value={detailForm.unit_id} onChange={(e) => setFormValue('unit_id', e.target.value)}>
                    <option value="">— ไม่ระบุ —</option>
                    {units.map((unit) => <option key={unit.unit_id} value={unit.unit_id}>{unit.unit_name ?? unit.unit_initial ?? `#${unit.unit_id}`}</option>)}
                  </select>
                </div>
                <div><label className="label">ปริมาณ (จำนวน)</label><input type="number" step="0.001" className="input" value={detailForm.log_act_detail_quatity} onChange={(e) => setFormValue('log_act_detail_quatity', e.target.value)} /></div>
                <div><label className="label">ปริมาณ/หน่วย</label><input type="number" step="0.001" className="input" value={detailForm.log_act_detail_volumePerUnit} onChange={(e) => setFormValue('log_act_detail_volumePerUnit', e.target.value)} /></div>
                <div><label className="label">ปริมาณรวม *</label><input type="number" step="0.001" className="input" required value={detailForm.log_act_detail_volumeAll} onChange={(e) => setFormValue('log_act_detail_volumeAll', e.target.value)} /></div>
                <div><label className="label">พื้นที่ทำงาน (ไร่)</label><input type="number" step="0.01" className="input" value={detailForm.log_act_detail_areawork} onChange={(e) => setFormValue('log_act_detail_areawork', e.target.value)} /></div>
              </FormSection>

              <div className="mt-5 flex gap-3">
                <button type="button" className="btn-secondary flex-1" onClick={closeDetailForm}>ยกเลิก</button>
                <button type="submit" className="btn-primary flex-1" disabled={createDetailMut.isPending}>
                  {createDetailMut.isPending ? 'กำลังบันทึก...' : editingDetail ? 'บันทึกการแก้ไข' : 'บันทึกกิจกรรม'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteDetailTarget}
        title="ลบรายการบันทึกกิจกรรม?"
        message={`ต้องการลบรายการบันทึกกิจกรรม #${deleteDetailTarget?.log_act_detail_id ?? ''} ใช่ไหม`}
        confirmLabel="ลบ"
        onConfirm={() => {
          if (deleteDetailTarget) deleteDetailMut.mutate(deleteDetailTarget.log_act_detail_id)
        }}
        onCancel={() => setDeleteDetailTarget(null)}
        isLoading={deleteDetailMut.isPending}
      />
    </div>
  )
}
