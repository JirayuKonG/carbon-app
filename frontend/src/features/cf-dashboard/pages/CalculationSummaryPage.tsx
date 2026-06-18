import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { BarChart3, Calculator, FileSearch, Layers, Leaf, ListChecks, RefreshCw, Search, ShieldCheck, X } from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { DatabaseConnectionNotice } from '@/components/ui/DatabaseConnectionNotice'
import { SourceBadge } from '../components/common/SourceBadge'
import { getCalculationSummary } from '../services/dashboardApi'
import type {
  CalculationInsight,
  CalculationSummaryAuditItem,
  CalculationSummaryGroupBy,
  CalculationSummaryMode,
  CalculationSummaryParams,
  CalculationSummaryResponse,
  CalculationSummaryRow,
  CalculationSummaryScope,
  DataSourceStatus,
} from '../types/dashboard'
import '../cf-dashboard.css'

const EMPTY_SUMMARY: CalculationSummaryResponse = {
  mode: 'footprint',
  datasourceStatus: 'missing',
  notes: [],
  filters: {
    yearOptions: [],
    campGroups: [],
    camps: [],
    lands: [],
  },
  kpi: {
    areaRai: 0,
    rowCount: 0,
    calculatedCount: 0,
    missingBreakdownCount: 0,
    grossEmissionTco2e: 0,
    socRemovalTco2e: 0,
    netEmissionTco2e: 0,
    intensityTco2ePerRai: null,
  },
  breakdowns: {
    emissionByFormula: [],
    emissionByResource: [],
    emissionByYear: [],
  },
  rows: [],
  insights: [],
}

const MODE_LABELS: Record<CalculationSummaryMode, string> = {
  footprint: 'Carbon Footprint',
  credit: 'Carbon Credit',
}

const SCOPE_LABELS: Record<CalculationSummaryScope, string> = {
  all: 'ทั้งหมด',
  camp_group: 'กลุ่มไร่',
  camp: 'ไร่ / แคมป์',
  land: 'แปลง',
}

const GROUP_LABELS: Record<CalculationSummaryGroupBy, string> = {
  year: 'ปีการผลิต',
  camp_group: 'กลุ่มไร่',
  camp: 'ไร่ / แคมป์',
  land: 'แปลง',
}

function formatNumber(value?: number | null, digits = 2) {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString('th-TH', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function statusLabel(status: DataSourceStatus) {
  if (status === 'api_real') return 'API real'
  if (status === 'api_partial') return 'API partial'
  if (status === 'missing') return 'Missing'
  return 'Fallback'
}

function statusClass(status: DataSourceStatus) {
  if (status === 'api_real') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'api_partial') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (status === 'missing') return 'border-rose-200 bg-rose-50 text-rose-700'
  return 'border-surface-200 bg-surface-50 text-surface-600'
}

function insightClass(type: CalculationInsight['type']) {
  if (type === 'good') return 'border-emerald-200 bg-emerald-50/80'
  if (type === 'warning') return 'border-amber-200 bg-amber-50/80'
  return 'border-sky-200 bg-sky-50/80'
}

function toggleValue(values: string[], value: string, max?: number) {
  if (values.includes(value)) return values.filter((item) => item !== value)
  if (max && values.length >= max) return values
  return [...values, value]
}

function buildScopeParam(scope: CalculationSummaryScope, scopeId: string) {
  if (!scopeId) return {}
  if (scope === 'camp_group') return { campGroupId: scopeId }
  if (scope === 'camp') return { campId: scopeId }
  if (scope === 'land') return { landId: scopeId }
  return {}
}

function LoadingNotice({ isInitialLoad, isFetching }: { isInitialLoad: boolean; isFetching: boolean }) {
  if (!isFetching) return null

  return (
    <div className="calculation-loading-popover" role="status" aria-live="polite">
      <RefreshCw size={18} />
      <div className="min-w-0">
        <strong>{isInitialLoad ? 'กำลังโหลดสรุปผลการคำนวณ' : 'กำลังอัปเดตผลตามตัวกรอง'}</strong>
        <span>ระบบกำลังดึงข้อมูลจริงจาก API กรุณารอสักครู่</span>
      </div>
    </div>
  )
}

function AuditModal({ row, onClose }: { row: CalculationSummaryRow; onClose: () => void }) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const selectedItem = row.auditItems[selectedIndex]

  return (
    <div className="fixed inset-0 z-[120] flex items-stretch justify-end bg-slate-950/45" onClick={onClose}>
      <div className="flex h-full w-full max-w-5xl flex-col bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex flex-col gap-3 border-b border-surface-200 px-5 py-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-surface-900">
              <FileSearch size={16} className="text-primary-600" />
              ที่มาของผลสรุป: {row.groupLabel}
            </div>
            <div className="mt-1 text-xs text-surface-500">
              {row.auditItems.length.toLocaleString('th-TH')} รายการจาก queue/detail ที่ใช้ประกอบแถวนี้
            </div>
          </div>
          <button type="button" className="btn-icon btn-ghost shrink-0" onClick={onClose} aria-label="ปิดที่มาของข้อมูล">
            <X size={16} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[360px_minmax(0,1fr)]">
          <div className="min-h-0 overflow-y-auto border-r border-surface-100 bg-surface-50/80 p-4">
            <div className="space-y-2">
              {row.auditItems.map((item, index) => (
                <button
                  key={`${item.queueId ?? 'q'}-${item.activityDetailId ?? 'd'}-${index}`}
                  type="button"
                  className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition ${index === selectedIndex ? 'border-primary-300 bg-white text-primary-800 shadow-sm' : 'border-surface-200 bg-white/75 text-surface-700 hover:border-primary-200'}`}
                  onClick={() => setSelectedIndex(index)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">Queue #{item.queueId ?? '—'}</span>
                    <span>{formatNumber(item.resultTco2e, 4)} tCO2e</span>
                  </div>
                  <div className="mt-1 truncate text-surface-500">{item.resourceName ?? 'ไม่ระบุปัจจัย'}</div>
                  <div className="mt-1 truncate text-surface-500">{item.landLabel ?? item.campLabel ?? 'ไม่ระบุพื้นที่'}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto p-5">
            {selectedItem ? (
              <AuditDetail item={selectedItem} />
            ) : (
              <div className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-6 text-center text-sm text-surface-500">
                ไม่พบ audit item
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function AuditDetail({ item }: { item: CalculationSummaryAuditItem }) {
  const details = [
    ['Queue ID', item.queueId],
    ['Activity detail ID', item.activityDetailId],
    ['ปีการผลิต', item.productionYearLabel],
    ['ไร่ / แคมป์', item.campLabel],
    ['แปลง', item.landLabel],
    ['ปัจจัย / resource', item.resourceName],
    ['Formula mode', item.formulaMode],
    ['Prepared amount', item.preparedAmount != null ? `${formatNumber(item.preparedAmount, 4)} ${item.preparedUnitLabel ?? ''}`.trim() : null],
    ['EF ID', item.efId],
    ['GWP ID', item.gwpId],
    ['Result', item.resultValue != null ? `${formatNumber(item.resultValue, 4)} ${item.resultUnitLabel ?? ''}`.trim() : null],
    ['Result tCO2e', item.resultTco2e != null ? `${formatNumber(item.resultTco2e, 4)} tCO2e` : null],
    ['Status', item.statusName],
    ['Error', item.errorMessage],
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {details.map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-surface-200 bg-white px-3 py-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-surface-400">{label}</div>
            <div className="mt-1 break-words text-sm font-medium text-surface-800">{value == null || value === '' ? '—' : String(value)}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-surface-200 bg-surface-950 text-surface-50 shadow-sm">
        <div className="border-b border-surface-800 px-4 py-3 text-xs font-semibold">calculation breakdown</div>
        <pre className="max-h-[45vh] overflow-auto whitespace-pre-wrap break-words px-4 py-3 text-xs leading-5">
          {item.calculationBreakdown ? JSON.stringify(item.calculationBreakdown, null, 2) : 'ไม่มี calculation breakdown ใน queue info'}
        </pre>
      </div>
    </div>
  )
}

export function CalculationSummaryPage() {
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState<CalculationSummaryMode>('footprint')
  const [selectedYears, setSelectedYears] = useState<string[]>([])
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo, setYearTo] = useState('')
  const [scope, setScope] = useState<CalculationSummaryScope>('all')
  const [scopeId, setScopeId] = useState('')
  const [groupBy, setGroupBy] = useState<CalculationSummaryGroupBy>('year')
  const [baselineYears, setBaselineYears] = useState<string[]>([])
  const [projectYear, setProjectYear] = useState('')
  const [auditRow, setAuditRow] = useState<CalculationSummaryRow | null>(null)

  const queryParams = useMemo<CalculationSummaryParams>(() => ({
    mode,
    ...(selectedYears.length ? { years: selectedYears.join(',') } : {}),
    ...(yearFrom ? { yearFrom } : {}),
    ...(yearTo ? { yearTo } : {}),
    scope,
    ...buildScopeParam(scope, scopeId),
    groupBy,
    ...(mode === 'credit' && baselineYears.length ? { baselineYears: baselineYears.join(',') } : {}),
    ...(mode === 'credit' && projectYear ? { projectYear } : {}),
  }), [baselineYears, groupBy, mode, projectYear, scope, scopeId, selectedYears, yearFrom, yearTo])

  const { data: result, isLoading, isFetching } = useQuery({
    queryKey: ['calculation-summary', queryParams],
    queryFn: () => getCalculationSummary(queryParams),
  })

  const summary = result?.data ?? EMPTY_SUMMARY
  const filters = summary.filters
  const scopeOptions = scope === 'camp_group'
    ? filters.campGroups
    : scope === 'camp'
      ? filters.camps
      : scope === 'land'
        ? filters.lands
        : []

  const kpiCards = [
    { key: 'gross', tone: 'blue', label: 'Gross Emission', value: `${formatNumber(summary.kpi.grossEmissionTco2e)} tCO2e`, icon: <Calculator size={15} /> },
    { key: 'soc', tone: 'green', label: 'SOC Removal', value: `${formatNumber(summary.kpi.socRemovalTco2e)} tCO2e`, icon: <Leaf size={15} /> },
    { key: 'net', tone: 'primary', label: 'Net Emission', value: `${formatNumber(summary.kpi.netEmissionTco2e)} tCO2e`, icon: <ShieldCheck size={15} /> },
    ...(mode === 'credit' ? [{ key: 'credit', tone: 'amber', label: 'Credit', value: `${formatNumber(summary.kpi.creditTco2e)} tCO2e`, icon: <BarChart3 size={15} /> }] : []),
    { key: 'intensity', tone: 'violet', label: mode === 'credit' ? 'Credit / ไร่' : 'Net / ไร่', value: `${formatNumber(summary.kpi.intensityTco2ePerRai, 4)} tCO2e/ไร่`, icon: <Layers size={15} /> },
    { key: 'rows', tone: 'slate', label: 'Queue ที่ใช้สรุป', value: summary.kpi.rowCount.toLocaleString('th-TH'), icon: <ListChecks size={15} /> },
  ]

  const columns: Column<CalculationSummaryRow>[] = [
    { key: 'groupLabel', header: GROUP_LABELS[groupBy], sortable: true, minWidth: '220px' },
    {
      key: 'areaRai',
      header: 'พื้นที่ไร่',
      sortable: true,
      render: (row) => <span className="font-mono">{formatNumber(row.areaRai)}</span>,
    },
    {
      key: 'grossEmissionTco2e',
      header: 'Gross tCO2e',
      sortable: true,
      render: (row) => <span className="font-mono">{formatNumber(row.grossEmissionTco2e)}</span>,
    },
    {
      key: 'socRemovalTco2e',
      header: 'SOC tCO2e',
      sortable: true,
      render: (row) => <span className="font-mono text-emerald-700">{formatNumber(row.socRemovalTco2e)}</span>,
    },
    {
      key: 'netEmissionTco2e',
      header: 'Net tCO2e',
      sortable: true,
      render: (row) => <span className="font-mono font-semibold">{formatNumber(row.netEmissionTco2e)}</span>,
    },
    ...(mode === 'credit' ? [{
      key: 'creditTco2e',
      header: 'Credit tCO2e',
      sortable: true,
      render: (row: CalculationSummaryRow) => <span className="font-mono font-semibold text-amber-700">{formatNumber(row.creditTco2e)}</span>,
    } satisfies Column<CalculationSummaryRow>] : []),
    {
      key: 'intensityTco2ePerRai',
      header: mode === 'credit' ? 'Credit / ไร่' : 'Net / ไร่',
      sortable: true,
      render: (row) => <span className="font-mono">{formatNumber(row.intensityTco2ePerRai, 4)}</span>,
    },
    {
      key: 'datasourceStatus',
      header: 'Datasource',
      sortable: true,
      render: (row) => (
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClass(row.datasourceStatus)}`}>
          {statusLabel(row.datasourceStatus)}
        </span>
      ),
    },
  ]

  const pageIssues = [
    { label: 'สรุปผลการคำนวณ', error: result?.error },
  ]

  const setModeAndDefaults = (nextMode: CalculationSummaryMode) => {
    setMode(nextMode)
    setGroupBy(nextMode === 'credit' ? 'land' : 'year')
    setAuditRow(null)
  }

  useEffect(() => {
    const nextMode = searchParams.get('mode') === 'credit' ? 'credit' : 'footprint'
    if (mode !== nextMode) {
      setModeAndDefaults(nextMode)
    }

    const requestedYears = (searchParams.get('years') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    const availableOrder = new Map(filters.yearOptions.map((option, index) => [option.value, index]))
    const nextYears = requestedYears
      .filter((value, index, array) => array.indexOf(value) === index)
      .filter((value) => !availableOrder.size || availableOrder.has(value))
      .sort((left, right) => (availableOrder.get(left) ?? Number.MAX_SAFE_INTEGER) - (availableOrder.get(right) ?? Number.MAX_SAFE_INTEGER))

    setSelectedYears((prev) => (
      prev.join('|') === nextYears.join('|')
        ? prev
        : nextYears
    ))
  }, [filters.yearOptions, mode, searchParams])

  return (
    <div className="cf-dash calculation-summary-page">
      <LoadingNotice isInitialLoad={isLoading} isFetching={isFetching} />
      <div className="page active">
        <div className="card calculation-summary-hero">
          <div className="page-header mb-0">
            <div className="min-w-0">
              <div className="calculation-summary-kicker">Calculation Result</div>
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-surface-900">
                <BarChart3 size={21} className="text-primary-600" />
                สรุปผลการคำนวณ
              </h1>
              <p className="page-subtitle">ผลรวมจาก queue, calculation breakdown, SOC และ credit result ที่มีอยู่ในระบบ</p>
            </div>
            <div className="calculation-summary-hero-right">
              <SourceBadge source={result?.source ?? 'api'} meta={result?.meta} loading={isFetching} />
              <div className={`calculation-status-pill ${summary.datasourceStatus}`}>
                {statusLabel(summary.datasourceStatus)}
              </div>
            </div>
          </div>
          <div className="calculation-summary-hero-metrics">
            <div>
              <span>Mode</span>
              <strong>{MODE_LABELS[mode]}</strong>
            </div>
            <div>
              <span>Calculated Queue</span>
              <strong>{summary.kpi.calculatedCount.toLocaleString('th-TH')}</strong>
            </div>
            <div>
              <span>Area</span>
              <strong>{formatNumber(summary.kpi.areaRai)} ไร่</strong>
            </div>
          </div>
        </div>

        <DatabaseConnectionNotice
          items={pageIssues}
          className="mt-4"
          onRetry={() => { void qc.refetchQueries({ queryKey: ['calculation-summary'] }) }}
        />

        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          <div className="card min-w-0 calculation-filter-card">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold text-surface-900">Shared Filter Workspace</div>
                <div className="mt-1 text-xs text-surface-500">ปีการผลิตใช้ label จริงจากฐานข้อมูล เช่น 63/64</div>
              </div>
              <button
                type="button"
                className="btn-ghost btn-sm w-full justify-center md:w-auto"
                onClick={() => {
                  setSelectedYears([])
                  setYearFrom('')
                  setYearTo('')
                  setScope('all')
                  setScopeId('')
                  setBaselineYears([])
                  setProjectYear('')
                }}
              >
                ล้างตัวกรอง
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="label">ปีการผลิต</label>
                <div className="calculation-year-picker mt-2 max-h-32 overflow-y-auto rounded-xl border border-surface-200 bg-surface-50 p-2">
                  {filters.yearOptions.length ? filters.yearOptions.map((option) => (
                    <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white">
                      <input
                        type="checkbox"
                        checked={selectedYears.includes(option.value)}
                        onChange={() => setSelectedYears((prev) => toggleValue(prev, option.value))}
                      />
                      <span>{option.label}</span>
                    </label>
                  )) : (
                    <div className="px-2 py-3 text-sm text-surface-500">ยังไม่มีปีการผลิตจาก queue</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="label">จากปีการผลิต</span>
                  <select className="select mt-1" value={yearFrom} onChange={(event) => setYearFrom(event.target.value)}>
                    <option value="">ทั้งหมด</option>
                    {filters.yearOptions.map((option) => <option key={`from-${option.value}`} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="label">ถึงปีการผลิต</span>
                  <select className="select mt-1" value={yearTo} onChange={(event) => setYearTo(event.target.value)}>
                    <option value="">ทั้งหมด</option>
                    {filters.yearOptions.map((option) => <option key={`to-${option.value}`} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="label">มุมมองพื้นที่</span>
                  <select className="select mt-1" value={scope} onChange={(event) => {
                    setScope(event.target.value as CalculationSummaryScope)
                    setScopeId('')
                  }}>
                    {(Object.keys(SCOPE_LABELS) as CalculationSummaryScope[]).map((value) => (
                      <option key={value} value={value}>{SCOPE_LABELS[value]}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="label">พื้นที่ที่เลือก</span>
                  <select className="select mt-1" value={scopeId} disabled={scope === 'all'} onChange={(event) => setScopeId(event.target.value)}>
                    <option value="">{scope === 'all' ? 'ไม่ต้องเลือก' : `ทุก${SCOPE_LABELS[scope]}`}</option>
                    {scopeOptions.map((option) => <option key={`${scope}-${option.id}`} value={option.id}>{option.label}</option>)}
                  </select>
                </label>
              </div>
            </div>

            {mode === 'credit' && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                <div className="mb-2 text-xs font-semibold text-amber-900">Carbon Credit baseline/project</div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="grid max-h-32 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-amber-100 bg-white/70 p-2 sm:grid-cols-2 lg:grid-cols-4">
                    {filters.yearOptions.map((option) => (
                      <label key={`baseline-${option.value}`} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-amber-50">
                        <input
                          type="checkbox"
                          checked={baselineYears.includes(option.value)}
                          disabled={!baselineYears.includes(option.value) && baselineYears.length >= 4}
                          onChange={() => setBaselineYears((prev) => toggleValue(prev.filter((year) => year !== projectYear), option.value, 4))}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                  <label className="block">
                    <span className="label">ปีโครงการ</span>
                    <select className="select mt-1" value={projectYear} onChange={(event) => {
                      setProjectYear(event.target.value)
                      setBaselineYears((prev) => prev.filter((year) => year !== event.target.value))
                    }}>
                      <option value="">ใช้ปีล่าสุด</option>
                      {filters.yearOptions.map((option) => <option key={`project-${option.value}`} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="card calculation-timeline-card">
            <div className="text-sm font-semibold text-surface-900">ลำดับการคำนวณ</div>
            <div className="calculation-timeline mt-3 grid grid-cols-1 gap-2 text-xs text-surface-700">
              {['Activity Log', 'Prepare Queue', 'Normalize Unit', 'Select Formula/EF', 'Calculate CFP', 'Compare Baseline/Project', 'Credit/SOC', 'Summary'].map((step, index) => (
                <div key={step} className="flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-3 py-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[11px] font-semibold text-primary-700">{index + 1}</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="calculation-summary-toolbar mt-5 flex flex-wrap items-center gap-2">
          {(Object.keys(MODE_LABELS) as CalculationSummaryMode[]).map((value) => (
            <button
              key={value}
              type="button"
              className={`calculation-mode-button btn-sm rounded-full border px-4 ${mode === value ? 'active' : ''}`}
              onClick={() => setModeAndDefaults(value)}
            >
              {MODE_LABELS[value]}
            </button>
          ))}
          <div className="ml-0 flex flex-wrap items-center gap-2 md:ml-auto">
            <Search size={14} className="text-surface-400" />
            <select className="select h-9 w-auto min-w-[160px]" value={groupBy} onChange={(event) => setGroupBy(event.target.value as CalculationSummaryGroupBy)}>
              {(Object.keys(GROUP_LABELS) as CalculationSummaryGroupBy[]).map((value) => (
                <option key={value} value={value}>รวมตาม{GROUP_LABELS[value]}</option>
              ))}
            </select>
            <button type="button" className="btn-secondary btn-sm" onClick={() => { void qc.refetchQueries({ queryKey: ['calculation-summary'] }) }}>
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </div>

        <div className="calculation-kpi-grid mt-5 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-4">
          {kpiCards.map((card) => (
            <div key={card.key} className={`calculation-kpi-card ${card.tone}`}>
              <div className="flex items-center gap-2">
                {card.icon}
                <span className="stat-label">{card.label}</span>
              </div>
              <p className="stat-value">{card.value}</p>
            </div>
          ))}
        </div>

        {summary.notes.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {summary.notes.join(' · ')}
          </div>
        )}

        <div className="calculation-content-grid mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="card min-w-0 calculation-table-card">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-semibold text-surface-900">{MODE_LABELS[mode]} Summary</h2>
                <p className="mt-1 text-xs text-surface-500">กดดูที่มาเพื่อเปิด audit drawer ของแถวสรุป</p>
              </div>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusClass(summary.datasourceStatus)}`}>
                {statusLabel(summary.datasourceStatus)}
              </span>
            </div>
            <DataTable
              data={summary.rows}
              columns={columns}
              isLoading={isLoading}
              rowKey={(row) => row.id}
              searchPlaceholder="ค้นหาแถวสรุป..."
              defaultPageSize={10}
              emptyMessage="ยังไม่มีผลสรุปการคำนวณตามตัวกรองนี้"
              actions={(row) => (
                <button type="button" className="btn-secondary btn-sm whitespace-nowrap" onClick={() => setAuditRow(row)}>
                  ดูที่มา
                </button>
              )}
            />
          </div>

          <div className="space-y-4 calculation-side-stack">
            <div className="card calculation-side-panel">
              <div className="mb-3 text-sm font-semibold text-surface-900">Insights</div>
              <div className="space-y-3">
                {summary.insights.length ? summary.insights.map((insight) => (
                  <div key={`${insight.title}-${insight.value}`} className={`calculation-insight-card rounded-xl border px-3 py-3 ${insightClass(insight.type)}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-surface-900">{insight.title}</div>
                        <div className="mt-1 text-xs leading-5 text-surface-600">{insight.detail}</div>
                      </div>
                      {insight.value && <div className="shrink-0 text-right text-sm font-semibold text-surface-900">{insight.value}</div>}
                    </div>
                  </div>
                )) : (
                  <div className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-6 text-center text-sm text-surface-500">
                    ยังไม่มี insight จากข้อมูลชุดนี้
                  </div>
                )}
              </div>
            </div>

            <div className="card calculation-side-panel">
              <div className="mb-3 text-sm font-semibold text-surface-900">Emission Breakdown</div>
              <div className="space-y-4 text-xs">
                <BreakdownList title="ตามสูตร" rows={summary.breakdowns.emissionByFormula} />
                <BreakdownList title="ตามปัจจัย" rows={summary.breakdowns.emissionByResource} />
                <div>
                  <div className="mb-2 font-semibold text-surface-700">ตามปีการผลิต</div>
                  <div className="space-y-1">
                    {summary.breakdowns.emissionByYear.map((row) => (
                      <div key={row.year} className="flex items-center justify-between gap-3 rounded-lg bg-surface-50 px-3 py-2">
                        <span className="truncate">{row.year}</span>
                        <span className="font-mono">{formatNumber(row.grossTco2e)} / {formatNumber(row.netTco2e)}</span>
                      </div>
                    ))}
                    {!summary.breakdowns.emissionByYear.length && <div className="text-surface-500">—</div>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {auditRow && <AuditModal row={auditRow} onClose={() => setAuditRow(null)} />}
    </div>
  )
}

function BreakdownList({ title, rows }: { title: string; rows: Array<{ name: string; valueTco2e: number }> }) {
  const maxValue = rows.reduce((max, row) => Math.max(max, row.valueTco2e), 0)
  return (
    <div>
      <div className="mb-2 font-semibold text-surface-700">{title}</div>
      <div className="space-y-1">
        {rows.slice(0, 6).map((row) => (
          <div key={`${title}-${row.name}`} className="rounded-lg bg-surface-50 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate">{row.name}</span>
              <span className="font-mono">{formatNumber(row.valueTco2e)} tCO2e</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-200">
              <div className="h-full rounded-full bg-primary-500" style={{ width: `${maxValue ? Math.max(4, (row.valueTco2e / maxValue) * 100) : 0}%` }} />
            </div>
          </div>
        ))}
        {!rows.length && <div className="text-surface-500">—</div>}
      </div>
    </div>
  )
}
