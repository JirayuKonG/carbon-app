import { type FormEvent, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Calculator, Leaf, Pencil, Plus, RefreshCw, Save, Sprout, Trash2 } from 'lucide-react'
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
  lands_camps?: { land_camp_name?: string | null } | null
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

const unitLabel = (unit?: Unit | null, fallback = '—') => {
  const label = [unit?.unit_initial, unit?.unit_name].filter(Boolean).join(' · ')
  return label || fallback
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

export function SoilOrganicCarbonPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const [socForm, setSocForm] = useState<SocFormState>(emptySocForm)
  const [plantForm, setPlantForm] = useState<SoilImprovementFormState>(emptySoilImprovementForm)
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

  const { data: units = [], error: unitsError } = useQuery({
    queryKey: ['emission-units'],
    queryFn: () => get<Unit[]>('/emission-factors/units'),
  })

  const { data: resourceOthers = [], error: resourceOthersError } = useQuery({
    queryKey: ['activity-resource-others'],
    queryFn: () => get<ResourceOther[]>('/activities/resource-others'),
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
    const tCO2ePerRai = tCPerRai * (44 / 12)
    return {
      area,
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

  const deleteMut = useMutation({
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
    setSocForm({
      id: row.carbon_soc_id,
      land_id: asString(row.land_id),
      carbon_soc_idCode: asString(row.carbon_soc_idCode),
      carbon_soc_socSampleIT: asString(row.carbon_soc_socSampleIT),
      unit_socSampleIT: asString(row.unit_socSampleIT),
      carbon_soc_bdSampleIt: asString(row.carbon_soc_bdSampleIt),
      unit_socbdSampleIT: asString(row.unit_socbdSampleIT),
      carbon_soc_depSampleIT: asString(row.carbon_soc_depSampleIT),
      unit_depSampleIT: asString(row.unit_depSampleIT),
      unit_socIT: asString(row.unit_socIT),
      carbon_soc_numLandSample: asString(row.carbon_soc_numLandSample),
      carbon_soc_numSample: asString(row.carbon_soc_numSample),
      carbon_soc_yearBeginPro: asString(row.carbon_soc_yearBeginPro),
    })
  }

  const editPlant = (row: SoilImprovementPlant) => {
    setPlantForm({
      id: row.carbon_soilImprovementPlant_id,
      land_id: asString(row.land_id),
      carbon_soilImprovementPlant_idCode: asString(row.carbon_soilImprovementPlant_idCode),
      act_resourceOther_id: asString(row.act_resourceOther_id),
      carbon_soilImprovementPlant_mc: asString(row.carbon_soilImprovementPlant_mc),
      unit_mc: asString(row.unit_mc),
      carbon_soilImprovementPlant_nc: asString(row.carbon_soilImprovementPlant_nc),
      unit_nc: asString(row.unit_nc),
      unit_fnFix: asString(row.unit_fnFix),
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
    { key: 'perRai', header: 'SOC tCO2e/ไร่', render: (row) => formatNumber(row.derived?.socTco2ePerRai, 4) },
    {
      key: 'result',
      header: 'SOC รวม',
      render: (row) => (
        <div>
          <div className="font-semibold text-emerald-700">{formatNumber(row.derived?.socTco2eTotal, 4)}</div>
          <div className="text-xs text-surface-500">{unitLabel(row.units_socIT, 'tCO2e')}</div>
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
          <div className="text-xs text-surface-500">{unitLabel(row.units_fnFix, 'tN')}</div>
        </div>
      ),
    },
  ]

  const queryIssues = [
    { label: 'SOC summary', error: summaryError },
    { label: 'SOC measurement', error: socError },
    { label: 'พืชปรับปรุงดิน', error: plantError },
    { label: 'แปลง', error: landsError },
    { label: 'หน่วย', error: unitsError },
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
          qc.invalidateQueries({ queryKey: ['emission-units'] })
          qc.invalidateQueries({ queryKey: ['activity-resource-others'] })
        }}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="stat-card border-l-4 border-l-emerald-500">
          <span className="stat-label">SOC รวม</span>
          <strong className="stat-value">{formatNumber(summary?.socTotalTco2e, 2)}</strong>
          <span className="stat-sub">tCO2e รวมทั้งแปลง</span>
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
              <div>
                <label className="label">แปลง</label>
                <select className="select" required value={plantForm.land_id} onChange={(event) => setPlantForm((prev) => ({ ...prev, land_id: event.target.value }))}>
                  <option value="">เลือกแปลง</option>
                  {lands.map((land) => (
                    <option key={land.land_id} value={land.land_id}>{landLabel(land)}</option>
                  ))}
                </select>
              </div>
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
                <label className="label">หน่วย mc</label>
                <select className="select" value={plantForm.unit_mc} onChange={(event) => setPlantForm((prev) => ({ ...prev, unit_mc: event.target.value }))}>
                  <option value="">ไม่ระบุ</option>
                  {units.map((unit) => <option key={unit.unit_id} value={unit.unit_id}>{unitLabel(unit)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">nc (%N)</label>
                <input type="number" step="0.0001" min="0" className="input" required value={plantForm.carbon_soilImprovementPlant_nc} onChange={(event) => setPlantForm((prev) => ({ ...prev, carbon_soilImprovementPlant_nc: event.target.value }))} />
              </div>
              <div>
                <label className="label">หน่วย nc</label>
                <select className="select" value={plantForm.unit_nc} onChange={(event) => setPlantForm((prev) => ({ ...prev, unit_nc: event.target.value }))}>
                  <option value="">ไม่ระบุ</option>
                  {units.map((unit) => <option key={unit.unit_id} value={unit.unit_id}>{unitLabel(unit)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">หน่วยผล Fnfix</label>
                <select className="select" value={plantForm.unit_fnFix} onChange={(event) => setPlantForm((prev) => ({ ...prev, unit_fnFix: event.target.value }))}>
                  <option value="">ให้ระบบเลือก tN</option>
                  {units.map((unit) => <option key={unit.unit_id} value={unit.unit_id}>{unitLabel(unit)}</option>)}
                </select>
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
            <div className="mt-4 flex flex-col gap-2">
              <button type="submit" className="btn-primary justify-center" disabled={savePlantMut.isPending}>
                {plantForm.id ? <Save size={15} /> : <Plus size={15} />}
                {savePlantMut.isPending ? 'กำลังบันทึก...' : plantForm.id ? 'บันทึกการแก้ไข' : 'เพิ่มรายการ'}
              </button>
              {plantForm.id && (
                <button type="button" className="btn-secondary justify-center" onClick={() => setPlantForm(emptySoilImprovementForm)}>
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
            <p className="mt-1 text-sm text-surface-500">คำนวณ SOC stock จาก SOC sample, bulk density, depth และพื้นที่แปลง</p>
          </div>
          <span className="badge-blue">{formatNumber(summary?.socMeasurementCount, 0)} รายการ</span>
        </div>

        <form className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]" onSubmit={onSubmitSoc}>
          <div className="rounded-xl border border-surface-100 bg-surface-50/60 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <label className="label">แปลง</label>
                <select className="select" required value={socForm.land_id} onChange={(event) => setSocForm((prev) => ({ ...prev, land_id: event.target.value }))}>
                  <option value="">เลือกแปลง</option>
                  {lands.map((land) => (
                    <option key={land.land_id} value={land.land_id}>{landLabel(land)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">รหัสรายการ</label>
                <input className="input" value={socForm.carbon_soc_idCode} onChange={(event) => setSocForm((prev) => ({ ...prev, carbon_soc_idCode: event.target.value }))} />
              </div>
              <div>
                <label className="label">ปีเริ่มโครงการ</label>
                <input className="input" value={socForm.carbon_soc_yearBeginPro} onChange={(event) => setSocForm((prev) => ({ ...prev, carbon_soc_yearBeginPro: event.target.value }))} />
              </div>
              <div>
                <label className="label">หน่วยผล SOC</label>
                <select className="select" value={socForm.unit_socIT} onChange={(event) => setSocForm((prev) => ({ ...prev, unit_socIT: event.target.value }))}>
                  <option value="">ให้ระบบเลือก tCO2e</option>
                  {units.map((unit) => <option key={unit.unit_id} value={unit.unit_id}>{unitLabel(unit)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">SOC sample (%)</label>
                <input type="number" step="0.0001" min="0" className="input" required value={socForm.carbon_soc_socSampleIT} onChange={(event) => setSocForm((prev) => ({ ...prev, carbon_soc_socSampleIT: event.target.value }))} />
              </div>
              <div>
                <label className="label">หน่วย SOC sample</label>
                <select className="select" value={socForm.unit_socSampleIT} onChange={(event) => setSocForm((prev) => ({ ...prev, unit_socSampleIT: event.target.value }))}>
                  <option value="">ไม่ระบุ</option>
                  {units.map((unit) => <option key={unit.unit_id} value={unit.unit_id}>{unitLabel(unit)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Bulk density</label>
                <input type="number" step="0.0001" min="0" className="input" required value={socForm.carbon_soc_bdSampleIt} onChange={(event) => setSocForm((prev) => ({ ...prev, carbon_soc_bdSampleIt: event.target.value }))} />
              </div>
              <div>
                <label className="label">หน่วย BD</label>
                <select className="select" value={socForm.unit_socbdSampleIT} onChange={(event) => setSocForm((prev) => ({ ...prev, unit_socbdSampleIT: event.target.value }))}>
                  <option value="">ไม่ระบุ</option>
                  {units.map((unit) => <option key={unit.unit_id} value={unit.unit_id}>{unitLabel(unit)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Depth (cm)</label>
                <input type="number" step="0.0001" min="0" className="input" required value={socForm.carbon_soc_depSampleIT} onChange={(event) => setSocForm((prev) => ({ ...prev, carbon_soc_depSampleIT: event.target.value }))} />
              </div>
              <div>
                <label className="label">หน่วย Depth</label>
                <select className="select" value={socForm.unit_depSampleIT} onChange={(event) => setSocForm((prev) => ({ ...prev, unit_depSampleIT: event.target.value }))}>
                  <option value="">ไม่ระบุ</option>
                  {units.map((unit) => <option key={unit.unit_id} value={unit.unit_id}>{unitLabel(unit)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">จำนวนแปลงตัวอย่าง</label>
                <input type="number" step="1" min="0" className="input" value={socForm.carbon_soc_numLandSample} onChange={(event) => setSocForm((prev) => ({ ...prev, carbon_soc_numLandSample: event.target.value }))} />
              </div>
              <div>
                <label className="label">จำนวนตัวอย่าง</label>
                <input type="number" step="1" min="0" className="input" value={socForm.carbon_soc_numSample} onChange={(event) => setSocForm((prev) => ({ ...prev, carbon_soc_numSample: event.target.value }))} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-sky-100 bg-sky-50/80 p-4">
            <div className="text-sm font-semibold text-sky-900">Preview SOC</div>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><span className="text-sky-700">พื้นที่</span><strong>{formatNumber(socPreview?.area, 2)} ไร่</strong></div>
              <div className="flex justify-between gap-3"><span className="text-sky-700">Ton C/ไร่</span><strong>{formatNumber(socPreview?.tCPerRai, 4)}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-sky-700">tCO2e/ไร่</span><strong>{formatNumber(socPreview?.tCO2ePerRai, 4)}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-sky-700">SOC รวม</span><strong>{formatNumber(socPreview?.total, 4)} tCO2e</strong></div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <button type="submit" className="btn-primary justify-center" disabled={saveSocMut.isPending}>
                {socForm.id ? <Save size={15} /> : <Plus size={15} />}
                {saveSocMut.isPending ? 'กำลังบันทึก...' : socForm.id ? 'บันทึกการแก้ไข' : 'เพิ่มรายการ'}
              </button>
              {socForm.id && (
                <button type="button" className="btn-secondary justify-center" onClick={() => setSocForm(emptySocForm)}>
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
