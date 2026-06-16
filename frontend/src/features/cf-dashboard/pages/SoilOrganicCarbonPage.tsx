import { type FormEvent, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Calculator, Leaf, Pencil, Plus, RefreshCw, Save, Search, Sprout, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { DatabaseConnectionNotice } from '@/components/ui/DatabaseConnectionNotice'
import { useToast } from '@/components/ui/Toast'
import { del, get, post, put } from '@/lib/api'

interface Unit {
  unit_id: number
  unit_name?: string | null
  unit_initial?: string | null
}

interface Land {
  land_id: number
  land_code?: string | null
  name?: string | null
  land_size?: number | string | null
  area_size?: number | string | null
  lands_camps?: {
    land_camp_name?: string | null
    land_camp_group_id?: number | null
    lands_camps_groups?: {
      land_camp_group_id?: number | null
      land_camp_group_idCode?: string | null
      land_camp_group_name?: string | null
    } | null
  } | null
}

interface CampGroup {
  land_camp_group_id: number
  land_camp_group_idCode?: string | null
  land_camp_group_name?: string | null
}

interface ResourceOther {
  act_resourceOther_id: number
  act_resourceOther_name?: string | null
  act_resourceOther_info?: string | null
}

interface SocMeasurement {
  carbon_soc_id: number
  land_id?: number | null
  carbon_soc_idCode?: string | null
  carbon_soc_socSampleIT?: number | string | null
  unit_socSampleIT?: number | null
  carbon_soc_bdSampleIt?: number | string | null
  unit_socbdSampleIT?: number | null
  carbon_soc_depSampleIT?: number | string | null
  unit_depSampleIT?: number | null
  carbon_soc_socIT?: number | string | null
  unit_socIT?: number | null
  carbon_soc_numLandSample?: number | null
  carbon_soc_numSample?: number | null
  carbon_soc_yearBeginPro?: string | null
  lands?: Land | null
  units_socSampleIT?: Unit | null
  units_socbdSampleIT?: Unit | null
  units_depSampleIT?: Unit | null
  units_socIT?: Unit | null
  derived?: {
    areaRai?: number | null
    socTco2eTotal?: number | null
    socTco2ePerRai?: number | null
  }
}

interface SoilImprovementPlant {
  carbon_soilImprovementPlant_id: number
  land_id?: number | null
  carbon_soilImprovementPlant_idCode?: string | null
  carbon_soilImprovementPlant_mc?: number | string | null
  unit_mc?: number | null
  carbon_soilImprovementPlant_nc?: number | string | null
  unit_nc?: number | null
  carbon_soilImprovementPlant_fnFix?: number | string | null
  unit_fnFix?: number | null
  act_resourceOther_id?: number | null
  lands?: Land | null
  activities_resourceOther?: ResourceOther | null
  units_mc?: Unit | null
  units_nc?: Unit | null
  units_fnFix?: Unit | null
  derived?: {
    areaRai?: number | null
    fnfixTnTotal?: number | null
    fnfixTnPerRai?: number | null
  }
}

interface CarbonSocSummary {
  socTotalTco2e: number
  fnfixTotalTn: number
  landCount: number
  missingInputCount: number
  socMeasurementCount: number
  soilImprovementPlantCount: number
}

type SocFormState = {
  id?: number
  land_id: string
  carbon_soc_idCode: string
  carbon_soc_socSampleIT: string
  unit_socSampleIT: string
  carbon_soc_bdSampleIt: string
  unit_socbdSampleIT: string
  carbon_soc_depSampleIT: string
  unit_depSampleIT: string
  unit_socIT: string
  carbon_soc_numLandSample: string
  carbon_soc_numSample: string
  carbon_soc_yearBeginPro: string
}

type SoilImprovementFormState = {
  id?: number
  land_id: string
  carbon_soilImprovementPlant_idCode: string
  act_resourceOther_id: string
  carbon_soilImprovementPlant_mc: string
  unit_mc: string
  carbon_soilImprovementPlant_nc: string
  unit_nc: string
  unit_fnFix: string
}

type DeleteTarget =
  | { type: 'soc'; id: number; name: string }
  | { type: 'plant'; id: number; name: string }

const SOC_ANNUALIZATION_YEARS = 20
const LAND_SELECT_LIMIT = 80

const socStandardUnits = [
  ['SOC sample', '%'],
  ['Bulk density', 'g/cm3'],
  ['Depth', 'cm'],
  ['ผล SOC', 'tCO2e/ปี'],
] as const

const plantStandardUnits = [
  ['mc dry matter', 'kg/ไร่'],
  ['nc nitrogen', '%N'],
  ['ผล Fnfix', 'tN'],
] as const

const emptySocForm: SocFormState = {
  land_id: '',
  carbon_soc_idCode: '',
  carbon_soc_socSampleIT: '',
  unit_socSampleIT: '',
  carbon_soc_bdSampleIt: '',
  unit_socbdSampleIT: '',
  carbon_soc_depSampleIT: '',
  unit_depSampleIT: '',
  unit_socIT: '',
  carbon_soc_numLandSample: '',
  carbon_soc_numSample: '',
  carbon_soc_yearBeginPro: '',
}

const emptySoilImprovementForm: SoilImprovementFormState = {
  land_id: '',
  carbon_soilImprovementPlant_idCode: '',
  act_resourceOther_id: '',
  carbon_soilImprovementPlant_mc: '',
  unit_mc: '',
  carbon_soilImprovementPlant_nc: '',
  unit_nc: '',
  unit_fnFix: '',
}

const asString = (value: unknown) => value === undefined || value === null ? '' : String(value)

const numberOrUndefined = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : undefined
}

const numberOrZero = (value: unknown) => {
  const num = Number(value ?? 0)
  return Number.isFinite(num) ? num : 0
}

const formatNumber = (value: unknown, digits = 2) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  return num.toLocaleString('th-TH', { maximumFractionDigits: digits })
}

const landAreaRai = (land?: Land | null) => {
  const landSize = numberOrZero(land?.land_size)
  if (landSize > 0) return landSize
  const areaSize = numberOrZero(land?.area_size)
  return areaSize > 0 ? areaSize : undefined
}

const landLabel = (land?: Land | null) => {
  if (!land) return '—'
  const code = land.land_code ? `${land.land_code} · ` : ''
  return `${code}${land.name || `แปลง ${land.land_id}`}`
}

const landCampGroupLabel = (land?: Land | null) => {
  const group = land?.lands_camps?.lands_camps_groups
  return group?.land_camp_group_name || group?.land_camp_group_idCode || (group?.land_camp_group_id ? `#${group.land_camp_group_id}` : 'ไม่มีกลุ่มไร่')
}

const groupLabel = (group?: CampGroup | null) => {
  if (!group) return 'ทุกกลุ่มไร่'
  return group.land_camp_group_name || group.land_camp_group_idCode || `#${group.land_camp_group_id}`
}

const normalizeSearch = (value: unknown) => String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

const landSearchText = (land: Land) => normalizeSearch([
  land.land_id,
  land.land_code,
  land.name,
  land.lands_camps?.land_camp_name,
  land.lands_camps?.lands_camps_groups?.land_camp_group_name,
  land.lands_camps?.lands_camps_groups?.land_camp_group_idCode,
].filter(Boolean).join(' '))

const filterLandOptions = (lands: Land[], filter: string, campGroupId?: string) => {
  const filteredByGroup = campGroupId
    ? lands.filter((land) => String(land.lands_camps?.land_camp_group_id ?? '') === campGroupId)
    : lands
  const query = normalizeSearch(filter)
  if (!query) return filteredByGroup
  return filteredByGroup.filter((land) => landSearchText(land).includes(query))
}

const payloadWithNumbers = (data: Record<string, unknown>) => {
  const payload: Record<string, unknown> = {}

  Object.entries(data).forEach(([key, value]) => {
    if (key === 'id') return
    const trimmed = typeof value === 'string' ? value.trim() : asString(value).trim()
    if (!trimmed) return
    const shouldBeNumber = key.endsWith('_id')
      || key.startsWith('unit_')
      || key.includes('Sample')
      || key.endsWith('_mc')
      || key.endsWith('_nc')
      || key === 'land_id'
      || key === 'act_resourceOther_id'
      || key === 'carbon_soc_bdSampleIt'
      || key === 'carbon_soc_depSampleIT'
      || key === 'carbon_soc_socSampleIT'

    payload[key] = shouldBeNumber ? Number(trimmed) : trimmed
  })

  return payload
}

type FilteredLandSelectProps = {
  label: string
  lands: Land[]
  campGroups: CampGroup[]
  value: string
  filter: string
  campGroupId: string
  onCampGroupChange: (value: string) => void
  onFilterChange: (value: string) => void
  onChange: (value: string) => void
  className?: string
}

function FilteredLandSelect({
  label,
  lands,
  campGroups,
  value,
  filter,
  campGroupId,
  onCampGroupChange,
  onFilterChange,
  onChange,
  className = '',
}: FilteredLandSelectProps) {
  const selectedLand = lands.find((land) => String(land.land_id) === value)
  const matchedLands = filterLandOptions(lands, filter, campGroupId)
  const limitedLands = matchedLands.slice(0, LAND_SELECT_LIMIT)
  const options = selectedLand && !limitedLands.some((land) => land.land_id === selectedLand.land_id)
    ? [selectedLand, ...limitedLands]
    : limitedLands
  const hiddenCount = Math.max(matchedLands.length - limitedLands.length, 0)

  return (
    <div className={className}>
      <label className="label">{label}</label>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
        <select className="select" value={campGroupId} onChange={(event) => onCampGroupChange(event.target.value)}>
          <option value="">ทุกกลุ่มไร่</option>
          {campGroups.map((group) => (
            <option key={group.land_camp_group_id} value={group.land_camp_group_id}>
              {groupLabel(group)}
            </option>
          ))}
        </select>
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            className="input pl-9"
            placeholder="ค้นหารหัสแปลง / ชื่อ / แคมป์"
            value={filter}
            onChange={(event) => onFilterChange(event.target.value)}
          />
        </div>
        <select className="select" required value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">เลือกแปลง</option>
          {options.map((land) => (
            <option key={land.land_id} value={land.land_id}>
              {landLabel(land)} · {land.lands_camps?.land_camp_name || 'ไม่ระบุแคมป์'}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-surface-500">
        <span>พบ {formatNumber(matchedLands.length, 0)} จาก {formatNumber(lands.length, 0)} แปลง</span>
        {hiddenCount > 0 && <span>พิมพ์เพิ่มเพื่อเจาะจงอีก {formatNumber(hiddenCount, 0)} แปลง</span>}
        {selectedLand && (
          <span className="font-medium text-surface-700">
            เลือกอยู่: {landLabel(selectedLand)} · {landCampGroupLabel(selectedLand)} · {formatNumber(landAreaRai(selectedLand), 2)} ไร่
          </span>
        )}
      </div>
    </div>
  )
}

function StandardUnitStrip({ items }: { items: readonly (readonly [string, string])[] }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {items.map(([label, unit]) => (
        <span key={`${label}-${unit}`} className="rounded-md border border-surface-200 bg-white px-2 py-1 text-surface-700">
          <span className="text-surface-500">{label}</span> <strong>{unit}</strong>
        </span>
      ))}
    </div>
  )
}

export function SoilOrganicCarbonPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const [socForm, setSocForm] = useState<SocFormState>(emptySocForm)
  const [plantForm, setPlantForm] = useState<SoilImprovementFormState>(emptySoilImprovementForm)
  const [socLandFilter, setSocLandFilter] = useState('')
  const [plantLandFilter, setPlantLandFilter] = useState('')
  const [socCampGroupFilter, setSocCampGroupFilter] = useState('')
  const [plantCampGroupFilter, setPlantCampGroupFilter] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  const { data: summary, error: summaryError } = useQuery({
    queryKey: ['carbon-soc-summary'],
    queryFn: () => get<CarbonSocSummary>('/carbon-soc/summary'),
  })

  const { data: socRows = [], isLoading: socLoading, error: socError } = useQuery({
    queryKey: ['carbon-soc-soc-measurements'],
    queryFn: () => get<SocMeasurement[]>('/carbon-soc/soc-measurements'),
  })

  const { data: plantRows = [], isLoading: plantLoading, error: plantError } = useQuery({
    queryKey: ['carbon-soc-soil-improvement-plants'],
    queryFn: () => get<SoilImprovementPlant[]>('/carbon-soc/soil-improvement-plants'),
  })

  const { data: lands = [], error: landsError } = useQuery({
    queryKey: ['lands'],
    queryFn: () => get<Land[]>('/lands'),
  })

  const { data: resourceOthers = [], error: resourceOthersError } = useQuery({
    queryKey: ['activity-resource-others'],
    queryFn: () => get<ResourceOther[]>('/activities/resource-others'),
  })

  const { data: campGroups = [], error: campGroupsError } = useQuery({
    queryKey: ['camp-groups'],
    queryFn: () => get<CampGroup[]>('/lands/camp-groups'),
  })

  const landById = useMemo(() => {
    return Object.fromEntries(lands.map((land) => [land.land_id, land]))
  }, [lands])

  const selectedSocLand = socForm.land_id ? landById[Number(socForm.land_id)] : undefined
  const selectedPlantLand = plantForm.land_id ? landById[Number(plantForm.land_id)] : undefined
  const socPreview = useMemo(() => {
    const area = landAreaRai(selectedSocLand)
    const soc = numberOrUndefined(socForm.carbon_soc_socSampleIT)
    const bd = numberOrUndefined(socForm.carbon_soc_bdSampleIt)
    const depth = numberOrUndefined(socForm.carbon_soc_depSampleIT)
    if (!area || !soc || !bd || !depth) return null

    const tCPerRai = soc * bd * depth * 0.16
    const tCO2ePerRai = (tCPerRai * (44 / 12)) / SOC_ANNUALIZATION_YEARS
    return {
      area,
      soc,
      bd,
      depth,
      tCPerRai,
      tCO2ePerRai,
      total: tCO2ePerRai * area,
    }
  }, [selectedSocLand, socForm.carbon_soc_bdSampleIt, socForm.carbon_soc_depSampleIT, socForm.carbon_soc_socSampleIT])

  const plantPreview = useMemo(() => {
    const area = landAreaRai(selectedPlantLand)
    const mc = numberOrUndefined(plantForm.carbon_soilImprovementPlant_mc)
    const nc = numberOrUndefined(plantForm.carbon_soilImprovementPlant_nc)
    if (!area || !mc || !nc) return null

    const tNPerRai = (mc / 1000) * (nc / 100)
    return {
      area,
      mc,
      nc,
      tNPerRai,
      total: area * tNPerRai,
    }
  }, [plantForm.carbon_soilImprovementPlant_mc, plantForm.carbon_soilImprovementPlant_nc, selectedPlantLand])

  const invalidateSoc = () => {
    qc.invalidateQueries({ queryKey: ['carbon-soc-summary'] })
    qc.invalidateQueries({ queryKey: ['carbon-soc-soc-measurements'] })
    qc.invalidateQueries({ queryKey: ['carbon-soc-soil-improvement-plants'] })
  }

  const saveSocMut = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: Record<string, unknown> }) =>
      id
        ? put<SocMeasurement>(`/carbon-soc/soc-measurements/${id}`, payload)
        : post<SocMeasurement>('/carbon-soc/soc-measurements', payload),
    onSuccess: () => {
      invalidateSoc()
      setSocForm(emptySocForm)
      setSocLandFilter('')
      setSocCampGroupFilter('')
      toast.success('บันทึกข้อมูล SOC แล้ว')
    },
    onError: (error) => toast.error('บันทึกข้อมูล SOC ไม่สำเร็จ', error instanceof Error ? error.message : undefined),
  })

  const savePlantMut = useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: Record<string, unknown> }) =>
      id
        ? put<SoilImprovementPlant>(`/carbon-soc/soil-improvement-plants/${id}`, payload)
        : post<SoilImprovementPlant>('/carbon-soc/soil-improvement-plants', payload),
    onSuccess: () => {
      invalidateSoc()
      setPlantForm(emptySoilImprovementForm)
      setPlantLandFilter('')
      setPlantCampGroupFilter('')
      toast.success('บันทึกข้อมูลพืชปรับปรุงดินแล้ว')
    },
    onError: (error) => toast.error('บันทึกข้อมูลพืชปรับปรุงดินไม่สำเร็จ', error instanceof Error ? error.message : undefined),
  })

  const calculateSocMut = useMutation({
    mutationFn: (id: number) => post<SocMeasurement>(`/carbon-soc/soc-measurements/${id}/calculate`),
    onSuccess: () => {
      invalidateSoc()
      toast.success('คำนวณ SOC สำเร็จ')
    },
    onError: (error) => toast.error('คำนวณ SOC ไม่สำเร็จ', error instanceof Error ? error.message : undefined),
  })

  const calculatePlantMut = useMutation({
    mutationFn: (id: number) => post<SoilImprovementPlant>(`/carbon-soc/soil-improvement-plants/${id}/calculate`),
    onSuccess: () => {
      invalidateSoc()
      toast.success('คำนวณ Fnfix สำเร็จ')
    },
    onError: (error) => toast.error('คำนวณ Fnfix ไม่สำเร็จ', error instanceof Error ? error.message : undefined),
  })

  const deleteMut = useMutation<unknown, Error, DeleteTarget>({
    mutationFn: (target: DeleteTarget) =>
      target.type === 'soc'
        ? del<SocMeasurement>(`/carbon-soc/soc-measurements/${target.id}`)
        : del<SoilImprovementPlant>(`/carbon-soc/soil-improvement-plants/${target.id}`),
    onSuccess: (_, target) => {
      invalidateSoc()
      setDeleteTarget(null)
      toast.success(target.type === 'soc' ? 'ลบข้อมูล SOC แล้ว' : 'ลบข้อมูลพืชปรับปรุงดินแล้ว')
    },
    onError: (error) => toast.error('ลบข้อมูลไม่สำเร็จ', error instanceof Error ? error.message : undefined),
  })

  const onSubmitSoc = (event: FormEvent) => {
    event.preventDefault()
    saveSocMut.mutate({
      id: socForm.id,
      payload: payloadWithNumbers(socForm),
    })
  }

  const onSubmitPlant = (event: FormEvent) => {
    event.preventDefault()
    savePlantMut.mutate({
      id: plantForm.id,
      payload: payloadWithNumbers(plantForm),
    })
  }

  const editSoc = (row: SocMeasurement) => {
    setSocLandFilter(landLabel(row.lands))
    setSocCampGroupFilter(asString(row.lands?.lands_camps?.land_camp_group_id))
    setSocForm({
      id: row.carbon_soc_id,
      land_id: asString(row.land_id),
      carbon_soc_idCode: asString(row.carbon_soc_idCode),
      carbon_soc_socSampleIT: asString(row.carbon_soc_socSampleIT),
      unit_socSampleIT: '',
      carbon_soc_bdSampleIt: asString(row.carbon_soc_bdSampleIt),
      unit_socbdSampleIT: '',
      carbon_soc_depSampleIT: asString(row.carbon_soc_depSampleIT),
      unit_depSampleIT: '',
      unit_socIT: '',
      carbon_soc_numLandSample: asString(row.carbon_soc_numLandSample),
      carbon_soc_numSample: asString(row.carbon_soc_numSample),
      carbon_soc_yearBeginPro: asString(row.carbon_soc_yearBeginPro),
    })
  }

  const editPlant = (row: SoilImprovementPlant) => {
    setPlantLandFilter(landLabel(row.lands))
    setPlantCampGroupFilter(asString(row.lands?.lands_camps?.land_camp_group_id))
    setPlantForm({
      id: row.carbon_soilImprovementPlant_id,
      land_id: asString(row.land_id),
      carbon_soilImprovementPlant_idCode: asString(row.carbon_soilImprovementPlant_idCode),
      act_resourceOther_id: asString(row.act_resourceOther_id),
      carbon_soilImprovementPlant_mc: asString(row.carbon_soilImprovementPlant_mc),
      unit_mc: '',
      carbon_soilImprovementPlant_nc: asString(row.carbon_soilImprovementPlant_nc),
      unit_nc: '',
      unit_fnFix: '',
    })
  }

  const socColumns: Column<SocMeasurement>[] = [
    {
      key: 'land',
      header: 'แปลง',
      minWidth: '220px',
      render: (row) => (
        <div className="min-w-0">
          <div className="font-medium text-surface-900">{landLabel(row.lands)}</div>
          <div className="text-xs text-surface-500">{row.lands?.lands_camps?.land_camp_name || 'ไม่ระบุแคมป์'}</div>
        </div>
      ),
    },
    { key: 'carbon_soc_yearBeginPro', header: 'ปีเริ่มโครงการ', render: (row) => row.carbon_soc_yearBeginPro || '—' },
    { key: 'carbon_soc_socSampleIT', header: 'SOC sample', render: (row) => formatNumber(row.carbon_soc_socSampleIT, 4) },
    { key: 'carbon_soc_bdSampleIt', header: 'BD', render: (row) => formatNumber(row.carbon_soc_bdSampleIt, 4) },
    { key: 'carbon_soc_depSampleIT', header: 'Depth', render: (row) => formatNumber(row.carbon_soc_depSampleIT, 4) },
    { key: 'area', header: 'พื้นที่ไร่', render: (row) => formatNumber(row.derived?.areaRai, 2) },
    { key: 'perRai', header: 'SOC tCO2e/ไร่/ปี', render: (row) => formatNumber(row.derived?.socTco2ePerRai, 4) },
    {
      key: 'result',
      header: 'SOC รวม/ปี',
      render: (row) => (
        <div>
          <div className="font-semibold text-emerald-700">{formatNumber(row.derived?.socTco2eTotal, 4)}</div>
          <div className="text-xs text-surface-500">tCO2e/ปี</div>
        </div>
      ),
    },
  ]

  const plantColumns: Column<SoilImprovementPlant>[] = [
    {
      key: 'land',
      header: 'แปลง',
      minWidth: '220px',
      render: (row) => (
        <div className="min-w-0">
          <div className="font-medium text-surface-900">{landLabel(row.lands)}</div>
          <div className="text-xs text-surface-500">{row.lands?.lands_camps?.land_camp_name || 'ไม่ระบุแคมป์'}</div>
        </div>
      ),
    },
    {
      key: 'resource',
      header: 'พืช/วัสดุ',
      minWidth: '180px',
      render: (row) => row.activities_resourceOther?.act_resourceOther_name || '—',
    },
    { key: 'carbon_soilImprovementPlant_mc', header: 'mc kg/ไร่', render: (row) => formatNumber(row.carbon_soilImprovementPlant_mc, 4) },
    { key: 'carbon_soilImprovementPlant_nc', header: 'nc %N', render: (row) => formatNumber(row.carbon_soilImprovementPlant_nc, 4) },
    { key: 'area', header: 'พื้นที่ไร่', render: (row) => formatNumber(row.derived?.areaRai, 2) },
    { key: 'perRai', header: 'Fnfix tN/ไร่', render: (row) => formatNumber(row.derived?.fnfixTnPerRai, 6) },
    {
      key: 'result',
      header: 'Fnfix รวม',
      render: (row) => (
        <div>
          <div className="font-semibold text-emerald-700">{formatNumber(row.derived?.fnfixTnTotal, 4)}</div>
          <div className="text-xs text-surface-500">tN</div>
        </div>
      ),
    },
  ]

  const queryIssues = [
    { label: 'SOC summary', error: summaryError },
    { label: 'SOC measurement', error: socError },
    { label: 'พืชปรับปรุงดิน', error: plantError },
    { label: 'แปลง', error: landsError },
    { label: 'กลุ่มไร่', error: campGroupsError },
    { label: 'resource other', error: resourceOthersError },
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <Leaf size={13} />
            Soil Organic Carbon
          </div>
          <h1 className="page-title">Soil Organic Carbon</h1>
          <p className="page-subtitle">จัดเก็บข้อมูลพืชคลุมดินและผลวัด SOC เพื่อคำนวณค่าที่ใช้ต่อใน Carbon Footprint / Carbon Credit</p>
        </div>
      </div>

      <DatabaseConnectionNotice
        items={queryIssues}
        onRetry={() => {
          qc.invalidateQueries({ queryKey: ['carbon-soc-summary'] })
          qc.invalidateQueries({ queryKey: ['carbon-soc-soc-measurements'] })
          qc.invalidateQueries({ queryKey: ['carbon-soc-soil-improvement-plants'] })
          qc.invalidateQueries({ queryKey: ['lands'] })
          qc.invalidateQueries({ queryKey: ['activity-resource-others'] })
          qc.invalidateQueries({ queryKey: ['camp-groups'] })
        }}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="stat-card border-l-4 border-l-emerald-500">
          <span className="stat-label">SOC รวม</span>
          <strong className="stat-value">{formatNumber(summary?.socTotalTco2e, 2)}</strong>
          <span className="stat-sub">tCO2e/ปี รวมทั้งแปลง</span>
        </div>
        <div className="stat-card border-l-4 border-l-sky-500">
          <span className="stat-label">Fnfix รวม</span>
          <strong className="stat-value">{formatNumber(summary?.fnfixTotalTn, 4)}</strong>
          <span className="stat-sub">tN จากพืชปรับปรุงดิน</span>
        </div>
        <div className="stat-card border-l-4 border-l-amber-500">
          <span className="stat-label">แปลงที่มีข้อมูล</span>
          <strong className="stat-value">{formatNumber(summary?.landCount, 0)}</strong>
          <span className="stat-sub">นับจากทั้ง 2 ตาราง</span>
        </div>
        <div className="stat-card border-l-4 border-l-red-400">
          <span className="stat-label">ยังขาด input</span>
          <strong className="stat-value">{formatNumber(summary?.missingInputCount, 0)}</strong>
          <span className="stat-sub">ต้องเติมก่อนคำนวณ</span>
        </div>
      </div>

      <section className="card space-y-5 border-t-4 border-t-emerald-500">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold text-surface-900">
              <Sprout size={18} className="text-emerald-600" />
              พืชคลุมดิน / พืชปรับปรุงดิน
            </div>
            <p className="mt-1 text-sm text-surface-500">คำนวณ Fnfix จาก dry matter ต่อไร่, ค่า N และพื้นที่แปลง</p>
          </div>
          <span className="badge-green">{formatNumber(summary?.soilImprovementPlantCount, 0)} รายการ</span>
        </div>

        <form className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]" onSubmit={onSubmitPlant}>
          <div className="rounded-xl border border-surface-100 bg-surface-50/60 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <FilteredLandSelect
                className="md:col-span-2"
                label="แปลง"
                lands={lands}
                campGroups={campGroups}
                value={plantForm.land_id}
                filter={plantLandFilter}
                campGroupId={plantCampGroupFilter}
                onCampGroupChange={setPlantCampGroupFilter}
                onFilterChange={setPlantLandFilter}
                onChange={(value) => setPlantForm((prev) => ({ ...prev, land_id: value }))}
              />
              <div>
                <label className="label">พืช/วัสดุ</label>
                <select className="select" value={plantForm.act_resourceOther_id} onChange={(event) => setPlantForm((prev) => ({ ...prev, act_resourceOther_id: event.target.value }))}>
                  <option value="">ไม่ระบุ</option>
                  {resourceOthers.map((resource) => (
                    <option key={resource.act_resourceOther_id} value={resource.act_resourceOther_id}>
                      {resource.act_resourceOther_name || `รายการ ${resource.act_resourceOther_id}`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">รหัสรายการ</label>
                <input className="input" value={plantForm.carbon_soilImprovementPlant_idCode} onChange={(event) => setPlantForm((prev) => ({ ...prev, carbon_soilImprovementPlant_idCode: event.target.value }))} />
              </div>
              <div>
                <label className="label">mc dry matter (kg/ไร่)</label>
                <input type="number" step="0.0001" min="0" className="input" required value={plantForm.carbon_soilImprovementPlant_mc} onChange={(event) => setPlantForm((prev) => ({ ...prev, carbon_soilImprovementPlant_mc: event.target.value }))} />
              </div>
              <div>
                <label className="label">nc (%N)</label>
                <input type="number" step="0.0001" min="0" className="input" required value={plantForm.carbon_soilImprovementPlant_nc} onChange={(event) => setPlantForm((prev) => ({ ...prev, carbon_soilImprovementPlant_nc: event.target.value }))} />
              </div>
              <div className="md:col-span-3">
                <label className="label">หน่วยมาตรฐาน</label>
                <StandardUnitStrip items={plantStandardUnits} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
            <div className="text-sm font-semibold text-emerald-900">Preview Fnfix</div>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><span className="text-emerald-700">พื้นที่</span><strong>{formatNumber(plantPreview?.area, 2)} ไร่</strong></div>
              <div className="flex justify-between gap-3"><span className="text-emerald-700">Fnfix ต่อไร่</span><strong>{formatNumber(plantPreview?.tNPerRai, 6)} tN/ไร่</strong></div>
              <div className="flex justify-between gap-3"><span className="text-emerald-700">Fnfix รวม</span><strong>{formatNumber(plantPreview?.total, 4)} tN</strong></div>
            </div>
            <div className="mt-4 rounded-lg border border-emerald-200 bg-white/75 p-3 text-xs text-emerald-950">
              <div className="font-semibold">Simulation สูตร</div>
              <div className="mt-2 space-y-1 font-mono leading-5">
                <div>tN/ไร่ = (mc / 1000) * (nc / 100)</div>
                <div>= ({formatNumber(plantPreview?.mc, 4)} / 1000) * ({formatNumber(plantPreview?.nc, 4)} / 100)</div>
                <div>รวม = {formatNumber(plantPreview?.tNPerRai, 6)} * {formatNumber(plantPreview?.area, 2)} = {formatNumber(plantPreview?.total, 4)} tN</div>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <button type="submit" className="btn-primary justify-center" disabled={savePlantMut.isPending}>
                {plantForm.id ? <Save size={15} /> : <Plus size={15} />}
                {savePlantMut.isPending ? 'กำลังบันทึก...' : plantForm.id ? 'บันทึกการแก้ไข' : 'เพิ่มรายการ'}
              </button>
              {plantForm.id && (
                <button
                  type="button"
                  className="btn-secondary justify-center"
                  onClick={() => {
                    setPlantForm(emptySoilImprovementForm)
                    setPlantLandFilter('')
                    setPlantCampGroupFilter('')
                  }}
                >
                  ยกเลิกแก้ไข
                </button>
              )}
            </div>
          </div>
        </form>

        <DataTable
          data={plantRows}
          columns={plantColumns}
          isLoading={plantLoading}
          rowKey={(row) => row.carbon_soilImprovementPlant_id}
          searchPlaceholder="ค้นหาแปลงหรือพืชปรับปรุงดิน..."
          actions={(row) => (
            <div className="flex items-center gap-1">
              <button type="button" className="btn-ghost btn-sm" onClick={() => calculatePlantMut.mutate(row.carbon_soilImprovementPlant_id)} disabled={calculatePlantMut.isPending}>
                <Calculator size={14} />
                คำนวณ
              </button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => editPlant(row)}>
                <Pencil size={14} />
                แก้ไข
              </button>
              <button type="button" className="btn-danger btn-sm" onClick={() => setDeleteTarget({ type: 'plant', id: row.carbon_soilImprovementPlant_id, name: landLabel(row.lands) })}>
                <Trash2 size={14} />
                ลบ
              </button>
            </div>
          )}
          emptyMessage="ยังไม่มีข้อมูลพืชคลุมดินหรือพืชปรับปรุงดิน"
        />
      </section>

      <section className="card space-y-5 border-t-4 border-t-sky-500">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold text-surface-900">
              <RefreshCw size={18} className="text-sky-600" />
              การวัดผล SOC
            </div>
            <p className="mt-1 text-sm text-surface-500">คำนวณ SOC stock แล้วเฉลี่ยผล CO2e เป็นรายปีตลอด 20 ปี จาก SOC sample, bulk density, depth และพื้นที่แปลง</p>
          </div>
          <span className="badge-blue">{formatNumber(summary?.socMeasurementCount, 0)} รายการ</span>
        </div>

        <form className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]" onSubmit={onSubmitSoc}>
          <div className="rounded-xl border border-surface-100 bg-surface-50/60 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <FilteredLandSelect
                className="md:col-span-2"
                label="แปลง"
                lands={lands}
                campGroups={campGroups}
                value={socForm.land_id}
                filter={socLandFilter}
                campGroupId={socCampGroupFilter}
                onCampGroupChange={setSocCampGroupFilter}
                onFilterChange={setSocLandFilter}
                onChange={(value) => setSocForm((prev) => ({ ...prev, land_id: value }))}
              />
              <div>
                <label className="label">รหัสรายการ</label>
                <input className="input" value={socForm.carbon_soc_idCode} onChange={(event) => setSocForm((prev) => ({ ...prev, carbon_soc_idCode: event.target.value }))} />
              </div>
              <div>
                <label className="label">ปีเริ่มโครงการ</label>
                <input className="input" value={socForm.carbon_soc_yearBeginPro} onChange={(event) => setSocForm((prev) => ({ ...prev, carbon_soc_yearBeginPro: event.target.value }))} />
              </div>
              <div>
                <label className="label">SOC sample (%)</label>
                <input type="number" step="0.0001" min="0" className="input" required value={socForm.carbon_soc_socSampleIT} onChange={(event) => setSocForm((prev) => ({ ...prev, carbon_soc_socSampleIT: event.target.value }))} />
              </div>
              <div>
                <label className="label">Bulk density (g/cm3)</label>
                <input type="number" step="0.0001" min="0" className="input" required value={socForm.carbon_soc_bdSampleIt} onChange={(event) => setSocForm((prev) => ({ ...prev, carbon_soc_bdSampleIt: event.target.value }))} />
              </div>
              <div>
                <label className="label">Depth (cm)</label>
                <input type="number" step="0.0001" min="0" className="input" required value={socForm.carbon_soc_depSampleIT} onChange={(event) => setSocForm((prev) => ({ ...prev, carbon_soc_depSampleIT: event.target.value }))} />
              </div>
              <div>
                <label className="label">จำนวนแปลงตัวอย่าง</label>
                <input type="number" step="1" min="0" className="input" value={socForm.carbon_soc_numLandSample} onChange={(event) => setSocForm((prev) => ({ ...prev, carbon_soc_numLandSample: event.target.value }))} />
              </div>
              <div>
                <label className="label">จำนวนตัวอย่าง</label>
                <input type="number" step="1" min="0" className="input" value={socForm.carbon_soc_numSample} onChange={(event) => setSocForm((prev) => ({ ...prev, carbon_soc_numSample: event.target.value }))} />
              </div>
              <div className="md:col-span-4">
                <label className="label">หน่วยมาตรฐาน</label>
                <StandardUnitStrip items={socStandardUnits} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-sky-100 bg-sky-50/80 p-4">
            <div className="text-sm font-semibold text-sky-900">Preview SOC</div>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><span className="text-sky-700">พื้นที่</span><strong>{formatNumber(socPreview?.area, 2)} ไร่</strong></div>
              <div className="flex justify-between gap-3"><span className="text-sky-700">Ton C/ไร่</span><strong>{formatNumber(socPreview?.tCPerRai, 4)}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-sky-700">tCO2e/ไร่/ปี</span><strong>{formatNumber(socPreview?.tCO2ePerRai, 4)}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-sky-700">SOC รวม/ปี</span><strong>{formatNumber(socPreview?.total, 4)} tCO2e/ปี</strong></div>
            </div>
            <div className="mt-4 rounded-lg border border-sky-200 bg-white/75 p-3 text-xs text-sky-950">
              <div className="font-semibold">Simulation สูตร</div>
              <div className="mt-2 space-y-1 font-mono leading-5">
                <div>Ton C/ไร่ = SOC * BD * Depth * 0.16</div>
                <div>= {formatNumber(socPreview?.soc, 4)} * {formatNumber(socPreview?.bd, 4)} * {formatNumber(socPreview?.depth, 4)} * 0.16 = {formatNumber(socPreview?.tCPerRai, 4)}</div>
                <div>tCO2e/ไร่/ปี = ({formatNumber(socPreview?.tCPerRai, 4)} * 44/12) / {SOC_ANNUALIZATION_YEARS} = {formatNumber(socPreview?.tCO2ePerRai, 4)}</div>
                <div>รวม/ปี = {formatNumber(socPreview?.tCO2ePerRai, 4)} * {formatNumber(socPreview?.area, 2)} = {formatNumber(socPreview?.total, 4)} tCO2e/ปี</div>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <button type="submit" className="btn-primary justify-center" disabled={saveSocMut.isPending}>
                {socForm.id ? <Save size={15} /> : <Plus size={15} />}
                {saveSocMut.isPending ? 'กำลังบันทึก...' : socForm.id ? 'บันทึกการแก้ไข' : 'เพิ่มรายการ'}
              </button>
              {socForm.id && (
                <button
                  type="button"
                  className="btn-secondary justify-center"
                  onClick={() => {
                    setSocForm(emptySocForm)
                    setSocLandFilter('')
                    setSocCampGroupFilter('')
                  }}
                >
                  ยกเลิกแก้ไข
                </button>
              )}
            </div>
          </div>
        </form>

        <DataTable
          data={socRows}
          columns={socColumns}
          isLoading={socLoading}
          rowKey={(row) => row.carbon_soc_id}
          searchPlaceholder="ค้นหาแปลงหรือข้อมูล SOC..."
          actions={(row) => (
            <div className="flex items-center gap-1">
              <button type="button" className="btn-ghost btn-sm" onClick={() => calculateSocMut.mutate(row.carbon_soc_id)} disabled={calculateSocMut.isPending}>
                <Calculator size={14} />
                คำนวณ
              </button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => editSoc(row)}>
                <Pencil size={14} />
                แก้ไข
              </button>
              <button type="button" className="btn-danger btn-sm" onClick={() => setDeleteTarget({ type: 'soc', id: row.carbon_soc_id, name: landLabel(row.lands) })}>
                <Trash2 size={14} />
                ลบ
              </button>
            </div>
          )}
          emptyMessage="ยังไม่มีข้อมูลการวัดผล SOC"
        />
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="ยืนยันการลบข้อมูล"
        message={deleteTarget ? `ต้องการลบรายการ ${deleteTarget.name} หรือไม่` : ''}
        confirmLabel="ลบข้อมูล"
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        isLoading={deleteMut.isPending}
      />
    </div>
  )
}
