import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { BarChart3, ClipboardList, Eye, Leaf, LoaderCircle, ShieldCheck, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { DatabaseConnectionNotice } from '@/components/ui/DatabaseConnectionNotice'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { useToast } from '@/components/ui/Toast'
import { get } from '@/lib/api'
import {
  calculateCarbonCredit,
  getCarbonCreditWorkspace,
  previewCarbonCreditCalculation,
} from '../services/carbonCreditApi'
import type {
  CarbonCreditCalculationRequest,
  CarbonCreditQueueRow,
  CarbonCreditScope,
  CarbonCreditWorkspaceResponse,
  Ef,
  Unit,
} from '../types/carbonCredit'
import '../cf-dashboard.css'

const BASELINE_SLOTS = [0, 1, 2, 3] as const
const SCOPE_LABELS: Record<CarbonCreditScope, string> = {
  all: 'ทั้งหมด',
  camp_group: 'กลุ่มไร่',
  camp: 'ไร่ / แคมป์',
  land: 'แปลง',
}

const SCENARIO_LABELS = {
  baseline: 'ปีฐาน',
  project: 'ปีโครงการ',
  outside_scope: 'นอกช่วง',
}

type QueueFilterKey = 'all' | 'calculable' | 'needs_cfp' | 'needs_ef' | 'selected' | 'persisted_credit' | 'outside_scope' | 'error'

const QUEUE_FILTER_LABELS: Record<QueueFilterKey, string> = {
  all: 'ทั้งหมด',
  calculable: 'มี CFP พร้อมใช้',
  needs_cfp: 'ยังขาด CFP',
  needs_ef: 'ต้องเลือก EF',
  selected: 'เลือกแล้ว',
  persisted_credit: 'มี Credit เดิม',
  outside_scope: 'นอกปีที่เลือก',
  error: 'มีปัญหา',
}

function formatNumber(value?: number | null, digits = 2) {
  return Number(value ?? 0).toLocaleString('th-TH', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function formatOptionalNumber(value?: number | null, digits = 2) {
  return value == null ? '—' : formatNumber(value, digits)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
}

function scenarioForYear(year: string, baselineYears: string[], projectYear: string) {
  if (projectYear && year === projectYear) return 'project' as const
  if (baselineYears.includes(year)) return 'baseline' as const
  return 'outside_scope' as const
}

function scenarioClass(scenario: string) {
  if (scenario === 'project') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (scenario === 'baseline') return 'border-sky-200 bg-sky-50 text-sky-700'
  return 'border-surface-200 bg-surface-50 text-surface-500'
}

function statusClass(status: string) {
  if (status === 'ready') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'skipped') return 'border-surface-200 bg-surface-50 text-surface-600'
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

function statusLabel(status: string) {
  if (status === 'ready') return 'พร้อม'
  if (status === 'skipped') return 'ไม่รวม'
  return 'ยังคำนวณไม่ได้'
}

function blockedFixText(reason?: string | null) {
  if (!reason) return ''
  const fixes: string[] = []
  if (reason.includes('ไม่มีข้อมูลปีโครงการ')) {
    fixes.push('เลือกปีโครงการที่มีข้อมูลของแปลงนี้ หรือเพิ่มกิจกรรมปีโครงการเข้า Carbon queue แล้วคำนวณ CFP ให้เสร็จ')
  }
  if (reason.includes('ไม่มีข้อมูลปีฐานที่ใช้เฉลี่ยได้')) {
    fixes.push('เลือกปีฐานที่มีข้อมูลของแปลงนี้อย่างน้อย 1 ปี หรือเพิ่มข้อมูลปีฐานเข้า Carbon queue แล้วคำนวณ CFP')
  }
  if (reason.includes('ยังไม่มีผล Carbon Footprint')) {
    fixes.push('คำนวณ Carbon Footprint ของ row ที่ยังขาดก่อน หรือเลือก EF ที่ขาดในขั้นตอน 3 แล้ว Preview ใหม่')
  }
  return Array.from(new Set(fixes)).join(' · ')
}

function efLabel(ef?: Ef) {
  if (!ef) return '—'
  return ef.coef_em_factor_name?.trim() || ef.coef_em_factor_idCode?.trim() || `EF #${ef.coefficient_emission_factor_id}`
}

function unitLabel(unit?: Unit) {
  return unit?.unit_initial?.trim() || unit?.unit_name?.trim() || '—'
}

function efInputUnitCandidates(ef: Ef) {
  return [
    { unitId: ef.unit_id, prefixId: ef.unit_prefix_id },
    { unitId: ef.unit_id_co2, prefixId: ef.unit_prefix_id_co2 },
    { unitId: ef.unit_id_ch4foss, prefixId: ef.unit_prefix_id_ch4foss },
    { unitId: ef.unit_id_ch4, prefixId: ef.unit_prefix_id_ch4 },
    { unitId: ef.unit_id_n2o, prefixId: ef.unit_prefix_id_n2o },
  ].filter((item) => item.unitId != null)
}

function efMatchesRow(ef: Ef, row: CarbonCreditQueueRow) {
  if (!row.preparedUnitId) return false
  return efInputUnitCandidates(ef).some((candidate) => (
    candidate.unitId === row.preparedUnitId
    && (
      row.preparedUnitPrefixId == null
      || candidate.prefixId == null
      || candidate.prefixId === row.preparedUnitPrefixId
    )
  ))
}

function cleanScopeParam(scope: CarbonCreditScope, scopeId: string) {
  const numericId = Number(scopeId)
  if (!Number.isFinite(numericId)) return {}
  if (scope === 'camp_group') return { campGroupId: numericId }
  if (scope === 'camp') return { campId: numericId }
  if (scope === 'land') return { landId: numericId }
  return {}
}

function rowMatchesQueueFilter(row: CarbonCreditQueueRow, filter: QueueFilterKey, efSelections: Record<number, { selectedEfId?: number }>) {
  if (filter === 'all') return true
  if (filter === 'calculable') return row.scenario !== 'outside_scope' && row.cfpResultTco2e != null && !row.errorMessage
  if (filter === 'needs_cfp') return row.scenario !== 'outside_scope' && row.cfpResultTco2e == null
  if (filter === 'needs_ef') {
    return row.scenario !== 'outside_scope'
      && row.formulaMode === 'generic_ef'
      && row.needsFootprintCalculation
      && !efSelections[row.queueId]?.selectedEfId
  }
  if (filter === 'selected') return row.selected
  if (filter === 'persisted_credit') return row.creditResultTco2e != null
  if (filter === 'outside_scope') return row.scenario === 'outside_scope'
  if (filter === 'error') return Boolean(row.errorMessage || row.footprintError)
  return true
}

export function CarbonCreditPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const calculationToastRef = useRef<string | null>(null)
  const [baselineYears, setBaselineYears] = useState<string[]>(['', '', '', ''])
  const [projectYear, setProjectYear] = useState('')
  const [scope, setScope] = useState<CarbonCreditScope>('all')
  const [scopeId, setScopeId] = useState('')
  const [includeSocRemoval, setIncludeSocRemoval] = useState(true)
  const [selectedQueueIds, setSelectedQueueIds] = useState<number[]>([])
  const [efSelections, setEfSelections] = useState<Record<number, { selectedEfId?: number }>>({})
  const [bulkEfId, setBulkEfId] = useState('')
  const [efSearch, setEfSearch] = useState('')
  const [queueFilter, setQueueFilter] = useState<QueueFilterKey>('all')
  const [previewResult, setPreviewResult] = useState<CarbonCreditWorkspaceResponse | null>(null)
  const [auditRow, setAuditRow] = useState<CarbonCreditQueueRow | null>(null)

  const selectedYears = useMemo(() => (
    [...baselineYears, projectYear].filter(Boolean)
  ), [baselineYears, projectYear])

  const workspaceParams = useMemo(() => ({
    ...(selectedYears.length ? { years: selectedYears.join(',') } : {}),
    scope,
    ...cleanScopeParam(scope, scopeId),
  }), [scope, scopeId, selectedYears])

  const { data: workspace, isLoading, error, isFetching } = useQuery({
    queryKey: ['carbon-credit-workspace', workspaceParams],
    queryFn: () => getCarbonCreditWorkspace(workspaceParams),
  })
  const { data: efs = [], error: efsError } = useQuery({
    queryKey: ['efs-carbon-credit'],
    queryFn: () => get<Ef[]>('/emission-factors/coefficients'),
  })
  const { data: units = [] } = useQuery({
    queryKey: ['units-carbon-credit'],
    queryFn: () => get<Unit[]>('/emission-factors/units'),
  })

  const source = previewResult ?? workspace
  const yearOptions = source?.filters.yearOptions ?? []
  const scopeOptions = scope === 'camp_group'
    ? source?.filters.campGroups ?? []
    : scope === 'camp'
      ? source?.filters.camps ?? []
      : scope === 'land'
        ? source?.filters.lands ?? []
        : []
  const completeBaselineYears = baselineYears.filter(Boolean)

  const rows = useMemo(() => (
    (source?.rows ?? []).map((row) => ({
      ...row,
      scenario: previewResult ? row.scenario : scenarioForYear(row.productionYearLabel, completeBaselineYears, projectYear),
      selected: selectedQueueIds.includes(row.queueId),
    }))
  ), [completeBaselineYears, previewResult, projectYear, selectedQueueIds, source?.rows])

  const filteredRows = rows.filter((row) => rowMatchesQueueFilter(row, queueFilter, efSelections))
  const selectableFilteredRows = filteredRows.filter((row) => row.scenario !== 'outside_scope')
  const queueFilterCounts = useMemo(() => {
    const keys: QueueFilterKey[] = ['all', 'calculable', 'needs_cfp', 'needs_ef', 'selected', 'persisted_credit', 'outside_scope', 'error']
    return Object.fromEntries(keys.map((key) => [
      key,
      rows.filter((row) => rowMatchesQueueFilter(row, key, efSelections)).length,
    ])) as Record<QueueFilterKey, number>
  }, [efSelections, rows])
  const selectedRows = rows.filter((row) => selectedQueueIds.includes(row.queueId))
  const selectedGenericMissingRows = selectedRows.filter((row) => (
    row.formulaMode === 'generic_ef'
    && row.needsFootprintCalculation
    && row.scenario !== 'outside_scope'
  ))
  const filteredEfs = efs
    .filter((ef) => ef.coef_em_factor_value_total != null || ef.coef_em_factor_value_co2 != null || ef.coef_em_factor_value_ch4 != null || ef.coef_em_factor_value_n2o != null)
    .filter((ef) => {
      const query = efSearch.trim().toLowerCase()
      if (!query) return true
      return [
        ef.coef_em_factor_name,
        ef.coef_em_factor_idCode,
        ef.coef_em_factor_info,
      ].filter(Boolean).join(' ').toLowerCase().includes(query)
    })
    .slice(0, 80)
  const selectedBulkEf = bulkEfId ? efs.find((ef) => String(ef.coefficient_emission_factor_id) === bulkEfId) : undefined
  const unitById = useMemo(() => Object.fromEntries(units.map((unit) => [unit.unit_id, unit])), [units])

  useEffect(() => {
    setPreviewResult(null)
    setSelectedQueueIds((prev) => prev.filter((id) => (workspace?.rows ?? []).some((row) => row.queueId === id)))
  }, [workspace])

  useEffect(() => {
    setPreviewResult(null)
  }, [baselineYears, projectYear, scope, scopeId, includeSocRemoval, selectedQueueIds, efSelections])

  useEffect(() => {
    const nextProjectYear = (searchParams.get('projectYear') ?? '').trim()
    if (!nextProjectYear) return
    setProjectYear((prev) => (prev === nextProjectYear ? prev : nextProjectYear))
  }, [searchParams])

  const buildPayload = (): CarbonCreditCalculationRequest | null => {
    if (completeBaselineYears.length !== 4) {
      toast.warning('เลือกปีฐานการผลิตไม่ครบ', 'ต้องเลือกปีฐานการผลิตให้ครบ 4 ปี')
      return null
    }
    if (new Set(completeBaselineYears).size !== completeBaselineYears.length) {
      toast.warning('ปีฐานซ้ำกัน', 'ปีฐานการผลิตทั้ง 4 ปีต้องไม่ซ้ำกัน')
      return null
    }
    if (!projectYear) {
      toast.warning('ยังไม่ได้เลือกปีโครงการ')
      return null
    }
    if (completeBaselineYears.includes(projectYear)) {
      toast.warning('ปีโครงการซ้ำกับปีฐาน', 'กรุณาเลือกปีโครงการคนละปีกับปีฐานการผลิต')
      return null
    }
    const activeSelectedQueueIds = rows
      .filter((row) => selectedQueueIds.includes(row.queueId) && row.scenario !== 'outside_scope')
      .map((row) => row.queueId)
    if (!activeSelectedQueueIds.length) {
      toast.warning('ยังไม่ได้เลือกรายการ', 'เลือก queue ที่ต้องการนำไปคำนวณ Carbon Credit ก่อน')
      return null
    }
    return {
      baselineYears: completeBaselineYears,
      projectYear,
      scope,
      ...cleanScopeParam(scope, scopeId),
      selectedQueueIds: activeSelectedQueueIds,
      includeSocRemoval,
      efSelections,
    }
  }

  const previewMut = useMutation({
    mutationFn: (payload: CarbonCreditCalculationRequest) => previewCarbonCreditCalculation(payload),
    onSuccess: (data) => {
      setPreviewResult(data)
      toast.success('Preview Carbon Credit แล้ว', `พร้อมอัปเดต ${data.writePlan.length.toLocaleString('th-TH')} รายการ`)
    },
    onError: (err) => toast.error('Preview ไม่สำเร็จ', getErrorMessage(err)),
  })

  const calculateMut = useMutation({
    mutationFn: (payload: CarbonCreditCalculationRequest) => calculateCarbonCredit(payload),
    onMutate: () => {
      calculationToastRef.current = toast.loading('กำลังคำนวณ Carbon Credit', 'ระบบกำลังคำนวณ CFP ที่ขาดและบันทึก Credit Candidate')
    },
    onSuccess: (data) => {
      if (calculationToastRef.current) toast.dismiss(calculationToastRef.current)
      calculationToastRef.current = null
      setPreviewResult(data)
      toast.success('คำนวณ Carbon Credit สำเร็จ', `บันทึกผล ${data.calculated?.updated ?? data.writePlan.length} รายการ`)
      void qc.invalidateQueries({ queryKey: ['carbon-credit-workspace'] })
      void qc.invalidateQueries({ queryKey: ['calculation-summary'] })
      void qc.invalidateQueries({ queryKey: ['carbon-process-queue'] })
    },
    onError: (err) => {
      if (calculationToastRef.current) toast.dismiss(calculationToastRef.current)
      calculationToastRef.current = null
      toast.error('คำนวณ Carbon Credit ไม่สำเร็จ', getErrorMessage(err))
    },
  })

  const toggleRow = (queueId: number) => {
    setSelectedQueueIds((prev) => prev.includes(queueId) ? prev.filter((id) => id !== queueId) : [...prev, queueId])
  }

  const selectAllVisible = () => {
    setSelectedQueueIds(Array.from(new Set(selectableFilteredRows.map((row) => row.queueId))))
  }

  const applyBulkEf = (mode: 'all_generic' | 'compatible') => {
    if (!selectedBulkEf) {
      toast.warning('ยังไม่ได้เลือก EF', 'เลือก emission factor ก่อนนำไปใช้กับหลาย row')
      return
    }
    const targetRows = selectedGenericMissingRows.filter((row) => mode === 'all_generic' || efMatchesRow(selectedBulkEf, row))
    if (!targetRows.length) {
      toast.warning('ไม่มี row ที่ใช้ EF นี้ได้', 'ตรวจหน่วยของ EF กับหน่วยหลังเตรียมข้อมูลของ row')
      return
    }
    setEfSelections((prev) => {
      const next = { ...prev }
      targetRows.forEach((row) => {
        next[row.queueId] = { ...(next[row.queueId] ?? {}), selectedEfId: selectedBulkEf.coefficient_emission_factor_id }
      })
      return next
    })
    toast.success('ใส่ EF ให้หลาย row แล้ว', `${targetRows.length.toLocaleString('th-TH')} row ถูกตั้งค่าเป็น ${efLabel(selectedBulkEf)}`)
  }

  const clearSelectedEf = () => {
    setEfSelections((prev) => {
      const next = { ...prev }
      selectedGenericMissingRows.forEach((row) => delete next[row.queueId])
      return next
    })
  }

  const columns: Column<CarbonCreditQueueRow>[] = [
    {
      key: 'selected',
      header: '',
      width: '54px',
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedQueueIds.includes(row.queueId)}
          disabled={row.scenario === 'outside_scope'}
          onChange={() => toggleRow(row.queueId)}
          onClick={(event) => event.stopPropagation()}
          aria-label={`เลือก queue ${row.queueId}`}
        />
      ),
    },
    {
      key: 'queueId',
      header: 'Queue',
      sortable: true,
      render: (row) => <span className="font-mono">#{row.queueId}</span>,
    },
    {
      key: 'scenario',
      header: 'Scenario',
      sortable: true,
      render: (row) => (
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${scenarioClass(row.scenario)}`}>
          {SCENARIO_LABELS[row.scenario]}
        </span>
      ),
    },
    { key: 'productionYearLabel', header: 'ปีการผลิต', sortable: true },
    { key: 'landLabel', header: 'แปลง', sortable: true, minWidth: '190px' },
    { key: 'campLabel', header: 'ไร่ / แคมป์', sortable: true, minWidth: '160px' },
    { key: 'resourceName', header: 'Resource', sortable: true, minWidth: '180px' },
    {
      key: 'formulaMode',
      header: 'Formula',
      sortable: true,
      render: (row) => <span className="font-mono text-xs">{row.formulaMode}</span>,
    },
    {
      key: 'preparedAmount',
      header: 'Prepared',
      sortable: true,
      render: (row) => <span className="font-mono">{formatOptionalNumber(row.preparedAmount)} {row.preparedUnitLabel}</span>,
    },
    {
      key: 'cfpResultTco2e',
      header: 'CFP tCO2e',
      sortable: true,
      render: (row) => (
        <span className={row.cfpResultTco2e == null ? 'text-amber-700' : 'font-mono text-surface-800'}>
          {row.cfpResultTco2e == null ? 'ต้องคำนวณ CFP' : formatNumber(row.cfpResultTco2e)}
        </span>
      ),
    },
    {
      key: 'creditResultTco2e',
      header: 'Credit เดิม',
      sortable: true,
      render: (row) => <span className="font-mono text-emerald-700">{formatOptionalNumber(row.creditResultTco2e)}</span>,
    },
    {
      key: 'statusName',
      header: 'Status',
      sortable: true,
      render: (row) => <span className="text-xs">{row.statusName ?? '—'}</span>,
    },
  ]

  const preview = previewResult
  const pageIssues = [
    { label: 'Carbon Credit workspace', error },
    { label: 'Emission factors', error: efsError },
  ]

  return (
    <div className="cf-dash">
      <div className="page active">
        <div className="card relative overflow-hidden border-0 bg-[linear-gradient(135deg,#f7fbff_0%,#eef9f2_48%,#fff8ed_100%)]">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-sky-400 to-amber-300" />
          <div className="page-header mb-0">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-medium text-emerald-700">
                <Leaf size={13} />
                Credit Candidate
              </div>
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-surface-900">
                <BarChart3 size={21} className="text-primary-600" />
                Carbon Credit
              </h1>
              <p className="page-subtitle">คำนวณจากค่าเฉลี่ยปีฐาน เทียบปีโครงการ และบันทึกผลกลับ Carbon Queue รายแปลง</p>
            </div>
            <div className="grid min-w-[220px] grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-white/70 bg-white/80 p-3">
                <span className="text-surface-500">Selected Rows</span>
                <strong className="mt-1 block text-lg text-surface-900">{selectedQueueIds.length.toLocaleString('th-TH')}</strong>
              </div>
              <div className="rounded-xl border border-white/70 bg-white/80 p-3">
                <span className="text-surface-500">Credit Preview</span>
                <strong className="mt-1 block text-lg text-emerald-700">{formatNumber(preview?.totals.creditCandidateTco2e)}</strong>
              </div>
            </div>
          </div>
        </div>

        <DatabaseConnectionNotice
          items={pageIssues}
          className="mt-4"
          onRetry={() => { void qc.refetchQueries({ queryKey: ['carbon-credit-workspace'] }) }}
        />

        <section className="card mt-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-surface-900">
                <SlidersHorizontal size={16} className="text-primary-600" />
                1. ตั้งค่ารอบคำนวณ
              </h2>
              <p className="mt-1 text-xs text-surface-500">เลือกปีฐาน 4 ปีและปีโครงการ 1 ปี ระบบจะคำนวณรายแปลงก่อนกระจายกลับ project rows</p>
            </div>
            {isFetching && (
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs text-blue-700">
                <LoaderCircle size={13} className="animate-spin" />
                กำลังโหลดข้อมูล
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            {BASELINE_SLOTS.map((index) => (
              <label key={index} className="block rounded-xl border border-surface-200 bg-surface-50 p-3">
                <span className="label">ปีฐานการผลิต {index + 1}</span>
                <select
                  className="select mt-1"
                  value={baselineYears[index]}
                  onChange={(event) => setBaselineYears((prev) => prev.map((year, i) => i === index ? event.target.value : year))}
                >
                  <option value="">— เลือกปี —</option>
                  {yearOptions.map((year) => <option key={`base-${index}-${year.value}`} value={year.value}>{year.label}</option>)}
                </select>
              </label>
            ))}
            <label className="block rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <span className="label">ปีโครงการ</span>
              <select className="select mt-1" value={projectYear} onChange={(event) => setProjectYear(event.target.value)}>
                <option value="">— เลือกปี —</option>
                {yearOptions.map((year) => <option key={`project-${year.value}`} value={year.value}>{year.label}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[220px_1fr_auto]">
            <label className="block">
              <span className="label">Scope พื้นที่</span>
              <select className="select mt-1" value={scope} onChange={(event) => { setScope(event.target.value as CarbonCreditScope); setScopeId('') }}>
                {(Object.keys(SCOPE_LABELS) as CarbonCreditScope[]).map((key) => <option key={key} value={key}>{SCOPE_LABELS[key]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label">รายการพื้นที่</span>
              <select className="select mt-1" value={scopeId} onChange={(event) => setScopeId(event.target.value)} disabled={scope === 'all'}>
                <option value="">{scope === 'all' ? 'ใช้ทุกพื้นที่' : '— เลือกพื้นที่ —'}</option>
                {scopeOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <label className="mt-6 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <input type="checkbox" checked={includeSocRemoval} onChange={(event) => setIncludeSocRemoval(event.target.checked)} />
              รวม SOC removal
            </label>
          </div>
        </section>

        <section className="card mt-5">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-surface-900">
                <ClipboardList size={16} className="text-primary-600" />
                2. เลือก Queue สำหรับ Carbon Credit
              </h2>
              <p className="mt-1 text-xs text-surface-500">เลือกเฉพาะ row ในปีฐาน/ปีโครงการที่ต้องการใช้คำนวณ</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary btn-sm" onClick={selectAllVisible}>เลือกตาม filter นี้</button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setSelectedQueueIds([])}>ล้างการเลือก</button>
            </div>
          </div>
          <div className="mb-3 rounded-2xl border border-surface-200 bg-surface-50 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-surface-600">Filter รายการ Queue</span>
              <span className="text-xs text-surface-500">
                แสดง {filteredRows.length.toLocaleString('th-TH')} / {rows.length.toLocaleString('th-TH')} รายการ
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['all', 'calculable', 'needs_cfp', 'needs_ef', 'selected', 'persisted_credit', 'outside_scope', 'error'] as QueueFilterKey[]).map((key) => {
                const active = queueFilter === key
                return (
                  <button
                    key={key}
                    type="button"
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? 'border-primary-300 bg-primary-50 text-primary-700 shadow-sm'
                        : 'border-white bg-white text-surface-600 hover:border-primary-200 hover:text-primary-700'
                    }`}
                    onClick={() => setQueueFilter(key)}
                  >
                    <span>{QUEUE_FILTER_LABELS[key]}</span>
                    <span className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${active ? 'bg-primary-100 text-primary-700' : 'bg-surface-100 text-surface-500'}`}>
                      {queueFilterCounts[key].toLocaleString('th-TH')}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="mt-2 text-xs text-surface-500">
              “มี CFP พร้อมใช้” คือ row ในปีฐาน/ปีโครงการที่มีผล Carbon Footprint แล้ว สามารถนำไปเป็นฐานคำนวณ Credit Candidate ได้ ส่วน “ต้องเลือก EF” คือ generic EF row ที่ยังขาด CFP และยังไม่ได้เลือก EF สำหรับคำนวณต่อ
            </div>
          </div>
          <DataTable
            data={filteredRows}
            columns={columns}
            isLoading={isLoading}
            rowKey={(row) => row.queueId}
            onRowClick={(row) => row.scenario !== 'outside_scope' && toggleRow(row.queueId)}
            actions={(row) => (
              <button type="button" className="btn-icon btn-ghost btn-sm" onClick={(event) => { event.stopPropagation(); setAuditRow(row) }} title="ดูที่มา">
                <Eye size={14} />
              </button>
            )}
            searchPlaceholder="ค้นหา queue, แปลง, resource..."
            defaultPageSize={10}
            emptyMessage="ไม่พบ queue สำหรับเงื่อนไขนี้"
          />
        </section>

        <section className="card mt-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-surface-900">
                <Sparkles size={16} className="text-amber-500" />
                3. จัดการ EF หลาย row
              </h2>
              <p className="mt-1 text-xs text-surface-500">ใช้กับ generic EF row ที่ยังไม่มีผล CFP ระบบ backend จะตรวจหน่วยซ้ำอีกครั้งก่อนคำนวณจริง</p>
            </div>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              {selectedGenericMissingRows.length.toLocaleString('th-TH')} row ต้องเลือก EF
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1.4fr_auto]">
            <label className="block">
              <span className="label">ค้นหา EF</span>
              <input className="input mt-1" value={efSearch} onChange={(event) => setEfSearch(event.target.value)} placeholder="ชื่อ EF หรือรหัส..." />
            </label>
            <label className="block">
              <span className="label">Emission Factor</span>
              <select className="select mt-1" value={bulkEfId} onChange={(event) => setBulkEfId(event.target.value)}>
                <option value="">— เลือก EF —</option>
                {filteredEfs.map((ef) => (
                  <option key={ef.coefficient_emission_factor_id} value={ef.coefficient_emission_factor_id}>
                    {efLabel(ef)} · input {unitLabel(unitById[ef.unit_id ?? 0])} · EF {formatOptionalNumber(ef.coef_em_factor_value_total, 6)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <button type="button" className="btn-secondary btn-sm" onClick={() => applyBulkEf('compatible')}>ใช้กับ row หน่วยตรงกัน</button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => applyBulkEf('all_generic')}>ใช้กับ generic ที่เลือก</button>
              <button type="button" className="btn-ghost btn-sm" onClick={clearSelectedEf}>ล้าง EF</button>
            </div>
          </div>

          {selectedGenericMissingRows.length > 0 && (
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {selectedGenericMissingRows.slice(0, 6).map((row) => {
                const selectedEf = efSelections[row.queueId]?.selectedEfId
                  ? efs.find((ef) => ef.coefficient_emission_factor_id === efSelections[row.queueId]?.selectedEfId)
                  : undefined
                return (
                  <div key={row.queueId} className="rounded-xl border border-surface-200 bg-surface-50 p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-surface-800">#{row.queueId} · {row.resourceName}</span>
                      <span className={selectedEf ? 'text-emerald-700' : 'text-amber-700'}>{selectedEf ? 'มี EF' : 'ยังไม่มี EF'}</span>
                    </div>
                    <p className="mt-1 text-surface-500">Prepared {formatOptionalNumber(row.preparedAmount)} {row.preparedUnitLabel}</p>
                    <p className="mt-1 truncate text-surface-600">{efLabel(selectedEf)}</p>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="card mt-5">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-surface-900">
                <ShieldCheck size={16} className="text-emerald-600" />
                4. Preview และ 5. Confirm & Calculate
              </h2>
              <p className="mt-1 text-xs text-surface-500">Preview จะบอกแปลงที่พร้อมและแปลงที่ยังคำนวณไม่ได้ก่อนบันทึกจริง</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={previewMut.isPending || calculateMut.isPending}
                onClick={() => {
                  const payload = buildPayload()
                  if (payload) previewMut.mutate(payload)
                }}
              >
                {previewMut.isPending ? 'กำลัง Preview...' : 'Preview ก่อนคำนวณ'}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={calculateMut.isPending}
                onClick={() => {
                  const payload = buildPayload()
                  if (payload) calculateMut.mutate(payload)
                }}
              >
                {calculateMut.isPending ? 'กำลังคำนวณ...' : 'ยืนยันและคำนวณ Carbon Credit'}
              </button>
            </div>
          </div>

          <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-800">
            ข้อมูลขั้นต่ำสำหรับ Credit Candidate: ต้องมีผล Carbon Footprint ของปีโครงการ และมีปีฐานที่ใช้เฉลี่ยได้อย่างน้อย 1 ปีในแปลงเดียวกัน
            ถ้าขาดบางปีฐาน ระบบยังคำนวณได้แต่จะแสดงคำเตือนเรื่องความครบถ้วนของข้อมูล ส่วนแปลงที่ไม่มีปีโครงการหรือไม่มีปีฐานที่ใช้เฉลี่ยได้เลยจะถูกข้ามและไม่ทำให้รอบคำนวณหยุด
          </div>

          <div className="grid gap-3 md:grid-cols-5">
            <div className="stat-card">
              <span className="stat-label">แปลงพร้อมคำนวณ</span>
              <strong className="stat-value">{(preview?.totals.readyLands ?? 0).toLocaleString('th-TH')}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">ไม่รวมรอบนี้</span>
              <strong className="stat-value text-surface-600">{(preview?.totals.skippedLands ?? 0).toLocaleString('th-TH')}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">Project rows ที่จะ update</span>
              <strong className="stat-value">{(preview?.totals.projectRowsToUpdate ?? 0).toLocaleString('th-TH')}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">ยังคำนวณไม่ได้</span>
              <strong className="stat-value text-amber-700">{(preview?.totals.blockedRows ?? 0).toLocaleString('th-TH')}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">Credit Candidate</span>
              <strong className="stat-value text-emerald-700">{formatNumber(preview?.totals.creditCandidateTco2e)} tCO2e</strong>
            </div>
          </div>

          {preview && (
            <div className="mt-5 grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
              <div className="overflow-hidden rounded-xl border border-surface-200">
                <div className="border-b border-surface-100 bg-surface-50 px-4 py-3 text-sm font-semibold">ผลรวมรายแปลง</div>
                <div className="max-h-[420px] overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-white text-xs text-surface-500">
                      <tr>
                        <th className="px-3 py-2 text-left">แปลง</th>
                        <th className="px-3 py-2 text-right">Baseline Avg</th>
                        <th className="px-3 py-2 text-right">Project</th>
                        <th className="px-3 py-2 text-right">SOC</th>
                        <th className="px-3 py-2 text-right">Credit</th>
                        <th className="px-3 py-2 text-left">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.landGroups.map((group) => (
                        <tr key={group.landId} className="border-t border-surface-100">
                          <td className="px-3 py-2">
                            <div className="font-medium text-surface-800">{group.landLabel}</div>
                            <div className="text-xs text-surface-500">{group.campLabel}</div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{formatNumber(group.baselineAverageTco2e)}</td>
                          <td className="px-3 py-2 text-right font-mono">{formatNumber(group.projectEmissionTco2e)}</td>
                          <td className="px-3 py-2 text-right font-mono text-emerald-700">{formatNumber(group.socRemovalTco2e)}</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold">{formatNumber(group.creditCandidateTco2e)}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClass(group.status)}`}>
                              {statusLabel(group.status)}
                            </span>
                            {group.status === 'ready' && (group.missingBaselineYears?.length ?? 0) > 0 && (
                              <div className="mt-1 max-w-[220px] text-xs text-sky-700">
                                เฉลี่ยจากปีฐานที่มีข้อมูล {group.baselineYearCount ?? 0}/4 ปี · ขาด {group.missingBaselineYears?.join(', ')}
                              </div>
                            )}
                            {group.blockedReason && (
                              <div className="mt-1 max-w-[260px] space-y-1 text-xs">
                                <div className={group.status === 'skipped' ? 'text-surface-600' : 'text-amber-700'}>{group.blockedReason}</div>
                                {group.status !== 'skipped' && blockedFixText(group.blockedReason) && (
                                  <div className="text-surface-600">วิธีแก้: {blockedFixText(group.blockedReason)}</div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-surface-200 bg-surface-50 p-4">
                <h3 className="text-sm font-semibold text-surface-900">หมายเหตุ / รายการที่ยังคำนวณไม่ได้</h3>
                <div className="mt-3 space-y-2">
                  {preview.notes.map((note) => (
                    <div key={note} className="rounded-lg border border-white bg-white px-3 py-2 text-xs text-surface-600">{note}</div>
                  ))}
                  {preview.blockedRows.slice(0, 8).map((item) => (
                    <div key={item.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      <div>
                        {item.queueId ? `Queue #${item.queueId}: ` : item.landLabel ? `${item.landLabel}: ` : ''}
                        {item.reason}
                      </div>
                      {blockedFixText(item.reason) && (
                        <div className="mt-1 text-surface-700">วิธีแก้: {blockedFixText(item.reason)}</div>
                      )}
                    </div>
                  ))}
                  {!preview.blockedRows.length && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                      ไม่มีรายการที่ยังคำนวณไม่ได้ใน preview ล่าสุด
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {calculateMut.isPending && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/35 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/70 bg-white p-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <LoaderCircle size={22} className="animate-spin text-primary-600" />
              <div>
                <div className="font-semibold text-surface-900">กำลังคำนวณ Carbon Credit</div>
                <p className="text-sm text-surface-500">ระบบกำลังคำนวณ CFP ที่ขาด บันทึก credit result และอัปเดต queue</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {auditRow && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-slate-950/35" onClick={() => setAuditRow(null)}>
          <aside className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-surface-100 bg-white px-5 py-4">
              <div>
                <h3 className="font-semibold text-surface-900">ที่มาของ Queue #{auditRow.queueId}</h3>
                <p className="text-xs text-surface-500">{auditRow.landLabel} · {auditRow.productionYearLabel}</p>
              </div>
              <button type="button" className="btn-icon btn-ghost" onClick={() => setAuditRow(null)}><X size={16} /></button>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Queue ID', `#${auditRow.queueId}`],
                  ['Detail ID', auditRow.activityDetailId ? `#${auditRow.activityDetailId}` : '—'],
                  ['Scenario', SCENARIO_LABELS[auditRow.scenario]],
                  ['Formula', auditRow.formulaMode],
                  ['Prepared', `${formatOptionalNumber(auditRow.preparedAmount)} ${auditRow.preparedUnitLabel ?? ''}`],
                  ['CFP', `${formatOptionalNumber(auditRow.cfpResultTco2e)} tCO2e`],
                  ['Credit เดิม', `${formatOptionalNumber(auditRow.creditResultTco2e)} tCO2e`],
                  ['Status', auditRow.statusName ?? '—'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                    <div className="text-xs text-surface-500">{label}</div>
                    <div className="mt-1 break-words font-medium text-surface-800">{value}</div>
                  </div>
                ))}
              </div>
              {auditRow.footprintError && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{auditRow.footprintError}</div>
              )}
              <div>
                <h4 className="mb-2 text-sm font-semibold text-surface-900">Calculation Snapshot</h4>
                <pre className="max-h-[420px] overflow-auto rounded-xl border border-surface-200 bg-surface-950 p-3 text-xs text-surface-50">
                  {JSON.stringify(auditRow.calculationInfo, null, 2)}
                </pre>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
