import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { DatabaseConnectionNotice } from '@/components/ui/DatabaseConnectionNotice'
import { Calculator, Droplets, Layers, Leaf, MapPin, Sprout, Tractor } from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { getActivityCalStatusKind } from '@/features/activities/cal-status'
import { get } from '@/lib/api'
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
  act_productYear_id?: number
  resource_used_type_id: number
  log_act_detail_volumeAll?: number
  log_act_detail_areawork?: number
  log_act_detail_calStatus_id?: number
  activities_fertilizers?: { act_fertilizer_name?: string }
  activities_equipments?: { act_equipment_name?: string }
  activities_chemiscals?: { act_chemiscal_name?: string }
  activities_resourceOther?: { act_resourceOther_name?: string }
  activities_productYear?: { act_productYear_name?: string }
  resource_used_type?: { resc_used_type_name?: string }
  log_act_detail_calStatus?: { log_act_detail_calStatus_name?: string }
  activities_header?: DetailHeaderLocation
}

type SelectionKey = 'baseline1' | 'baseline2' | 'baseline3' | 'baseline4' | 'projectYear'
type SelectionState = Record<SelectionKey, string>
type ResourceBucket = 'fertilizer' | 'fuel' | 'other'

interface YearLandAggregate {
  landId: number
  campName: string
  landCode: string
  landName: string
  area: number
  fertilizer: number
  fuel: number
  fertilizerNames: Set<string>
}

interface CarbonCreditRow {
  landId: number
  campName: string
  landLabel: string
  baselineArea: number
  projectArea: number
  baselineFertilizer: number
  projectFertilizer: number
  fertilizerDiff: number
  baselineFuel: number
  projectFuel: number
  fuelDiff: number
  baselineFertilizerNames: string
  projectFertilizerNames: string
}

const EMPTY_SELECTIONS: SelectionState = {
  baseline1: '',
  baseline2: '',
  baseline3: '',
  baseline4: '',
  projectYear: '',
}

const BASELINE_KEYS: SelectionKey[] = ['baseline1', 'baseline2', 'baseline3', 'baseline4']

const SELECTION_LABELS: Record<SelectionKey, string> = {
  baseline1: 'ปีฐานการผลิต 1',
  baseline2: 'ปีฐานการผลิต 2',
  baseline3: 'ปีฐานการผลิต 3',
  baseline4: 'ปีฐานการผลิต 4',
  projectYear: 'ปีการผลิตโครงการ',
}

function formatNumber(value: number, digits = 1) {
  return value.toLocaleString('th-TH', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function formatDiffText(value: number, unit: string) {
  const direction = value >= 0 ? 'ลดลง' : 'เพิ่มขึ้น'
  return `${direction} ${formatNumber(Math.abs(value))} ${unit}`
}

function parseYear(dateText?: string) {
  if (!dateText) return null
  const parsed = new Date(dateText)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.getFullYear()
}

function parseProductionYear(value?: string | null) {
  const text = value?.trim()
  if (!text) return null

  const fullYearMatch = text.match(/\b(24\d{2}|25\d{2}|26\d{2}|19\d{2}|20\d{2}|21\d{2})\b/)
  if (!fullYearMatch) return null

  const year = Number(fullYearMatch[1])
  return year >= 2400 ? year - 543 : year
}

function getDetailYear(detail: LogDetail) {
  return parseProductionYear(detail.activities_productYear?.act_productYear_name)
    ?? parseYear(detail.activities_header?.activities_header_startDate)
}

function getResourceBucket(detail: LogDetail): ResourceBucket {
  const text = [
    detail.resource_used_type?.resc_used_type_name,
    detail.activities_fertilizers?.act_fertilizer_name,
    detail.activities_equipments?.act_equipment_name,
    detail.activities_chemiscals?.act_chemiscal_name,
    detail.activities_resourceOther?.act_resourceOther_name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (/ปุ๋ย|fertilizer/.test(text)) return 'fertilizer'
  if (/น้ำมัน|fuel|diesel|gasohol|benzene|เบนซิน|tractor|machine|เครื่อง/.test(text)) return 'fuel'
  return 'other'
}

function createEmptyAggregate(detail: LogDetail, landId: number): YearLandAggregate {
  return {
    landId,
    campName: detail.activities_header?.lands?.lands_camps?.land_camp_name ?? '—',
    landCode: detail.activities_header?.lands?.land_code ?? `#${landId}`,
    landName: detail.activities_header?.lands?.name ?? '—',
    area: 0,
    fertilizer: 0,
    fuel: 0,
    fertilizerNames: new Set<string>(),
  }
}

export function CarbonCreditPage() {
  const qc = useQueryClient()
  const [selections, setSelections] = useState<SelectionState>(EMPTY_SELECTIONS)

  const { data: details = [], isLoading, error } = useQuery({
    queryKey: ['activity-details-carbon-credit'],
    queryFn: () => get<LogDetail[]>('/activities/details'),
  })

  const readyDetails = useMemo(() => (
    details.filter((detail) => (
      getActivityCalStatusKind(
        detail.log_act_detail_calStatus?.log_act_detail_calStatus_name,
        detail.log_act_detail_calStatus_id,
      ) === 'ready'
    ))
  ), [details])

  const availableYears = useMemo(() => (
    Array.from(new Set(
      readyDetails
        .map((detail) => getDetailYear(detail))
        .filter((year): year is number => year != null),
    )).sort((left, right) => left - right)
  ), [readyDetails])

  const validationMessage = useMemo(() => {
    if (!availableYears.length) return 'ยังไม่มีข้อมูลกิจกรรมสถานะพร้อมคำนวณมาตรฐานที่มีปีการผลิตสำหรับใช้คำนวณ Carbon Credit'

    const missingKey = (Object.keys(selections) as SelectionKey[]).find((key) => !selections[key])
    if (missingKey) return `กรุณาเลือก ${SELECTION_LABELS[missingKey]} ให้ครบทั้ง 5 ส่วน`

    const baselineYears = BASELINE_KEYS.map((key) => selections[key])
    if (new Set(baselineYears).size !== baselineYears.length) {
      return 'ปีฐานการผลิตทั้ง 4 ส่วนต้องไม่ซ้ำกัน'
    }

    if (baselineYears.includes(selections.projectYear)) {
      return 'ปีการผลิตโครงการต้องไม่ซ้ำกับปีฐานการผลิต'
    }

    return ''
  }, [availableYears, selections])

  const creditResult = useMemo(() => {
    if (validationMessage) {
      return {
        rows: [] as CarbonCreditRow[],
        totals: {
          plotCount: 0,
          baselineArea: 0,
          projectArea: 0,
          baselineFertilizer: 0,
          projectFertilizer: 0,
          fertilizerDiff: 0,
          baselineFuel: 0,
          projectFuel: 0,
          fuelDiff: 0,
        },
      }
    }

    const baselineYears = BASELINE_KEYS.map((key) => Number(selections[key]))
    const projectYear = Number(selections.projectYear)
    const selectedYearSet = new Set([...baselineYears, projectYear])
    const yearLandMap = new Map<number, Map<number, YearLandAggregate>>()

    readyDetails.forEach((detail) => {
      const year = getDetailYear(detail)
      const landId = detail.activities_header?.land_id

      if (!year || !selectedYearSet.has(year) || !landId) return

      const yearMap = yearLandMap.get(year) ?? new Map<number, YearLandAggregate>()
      const aggregate = yearMap.get(landId) ?? createEmptyAggregate(detail, landId)

      aggregate.area += detail.log_act_detail_areawork ?? 0

      const amount = detail.log_act_detail_volumeAll ?? 0
      const bucket = getResourceBucket(detail)

      if (bucket === 'fertilizer') {
        aggregate.fertilizer += amount
        const fertilizerName = detail.activities_fertilizers?.act_fertilizer_name?.trim()
        if (fertilizerName) aggregate.fertilizerNames.add(fertilizerName)
      } else if (bucket === 'fuel') {
        aggregate.fuel += amount
      }

      yearMap.set(landId, aggregate)
      yearLandMap.set(year, yearMap)
    })

    const landIds = new Set<number>()
    selectedYearSet.forEach((year) => {
      yearLandMap.get(year)?.forEach((_, landId) => landIds.add(landId))
    })

    const rows = Array.from(landIds).map((landId) => {
      const baselineAggregates = baselineYears.map((year) => yearLandMap.get(year)?.get(landId))
      const projectAggregate = yearLandMap.get(projectYear)?.get(landId)
      const sample = projectAggregate ?? baselineAggregates.find(Boolean)

      const divisor = baselineYears.length
      const baselineArea = baselineAggregates.reduce((sum, item) => sum + (item?.area ?? 0), 0) / divisor
      const baselineFertilizer = baselineAggregates.reduce((sum, item) => sum + (item?.fertilizer ?? 0), 0) / divisor
      const baselineFuel = baselineAggregates.reduce((sum, item) => sum + (item?.fuel ?? 0), 0) / divisor
      const projectArea = projectAggregate?.area ?? 0
      const projectFertilizer = projectAggregate?.fertilizer ?? 0
      const projectFuel = projectAggregate?.fuel ?? 0

      const baselineNames = new Set<string>()
      baselineAggregates.forEach((item) => item?.fertilizerNames.forEach((name) => baselineNames.add(name)))

      return {
        landId,
        campName: sample?.campName ?? '—',
        landLabel: sample ? `${sample.landCode} - ${sample.landName}` : `#${landId}`,
        baselineArea,
        projectArea,
        baselineFertilizer,
        projectFertilizer,
        fertilizerDiff: baselineFertilizer - projectFertilizer,
        baselineFuel,
        projectFuel,
        fuelDiff: baselineFuel - projectFuel,
        baselineFertilizerNames: Array.from(baselineNames).sort((left, right) => left.localeCompare(right, ['th', 'en'])).join(', ') || '—',
        projectFertilizerNames: projectAggregate ? Array.from(projectAggregate.fertilizerNames).sort((left, right) => left.localeCompare(right, ['th', 'en'])).join(', ') || '—' : '—',
      }
    })
      .filter((row) =>
        row.baselineArea > 0
        || row.projectArea > 0
        || row.baselineFertilizer > 0
        || row.projectFertilizer > 0
        || row.baselineFuel > 0
        || row.projectFuel > 0,
      )
      .sort((left, right) => (
        left.campName.localeCompare(right.campName, ['th', 'en'], { numeric: true, sensitivity: 'base' })
        || left.landLabel.localeCompare(right.landLabel, ['th', 'en'], { numeric: true, sensitivity: 'base' })
      ))

    const totals = rows.reduce((sum, row) => ({
      plotCount: sum.plotCount + 1,
      baselineArea: sum.baselineArea + row.baselineArea,
      projectArea: sum.projectArea + row.projectArea,
      baselineFertilizer: sum.baselineFertilizer + row.baselineFertilizer,
      projectFertilizer: sum.projectFertilizer + row.projectFertilizer,
      fertilizerDiff: sum.fertilizerDiff + row.fertilizerDiff,
      baselineFuel: sum.baselineFuel + row.baselineFuel,
      projectFuel: sum.projectFuel + row.projectFuel,
      fuelDiff: sum.fuelDiff + row.fuelDiff,
    }), {
      plotCount: 0,
      baselineArea: 0,
      projectArea: 0,
      baselineFertilizer: 0,
      projectFertilizer: 0,
      fertilizerDiff: 0,
      baselineFuel: 0,
      projectFuel: 0,
      fuelDiff: 0,
    })

    return { rows, totals }
  }, [readyDetails, selections, validationMessage])

  const columns: Column<CarbonCreditRow>[] = [
    { key: 'campName', header: 'ไร่ / แคมป์', sortable: true },
    { key: 'landLabel', header: 'แปลง', sortable: true },
    {
      key: 'baselineArea',
      header: 'ไร่เฉลี่ยปีฐานการผลิต',
      sortable: true,
      render: (row) => <span className="font-mono">{formatNumber(row.baselineArea)}</span>,
    },
    {
      key: 'projectArea',
      header: 'ไร่ปีการผลิตโครงการ',
      sortable: true,
      render: (row) => <span className="font-mono">{formatNumber(row.projectArea)}</span>,
    },
    {
      key: 'baselineFertilizer',
      header: 'ปุ๋ยเฉลี่ยปีฐานการผลิต',
      sortable: true,
      render: (row) => <span className="font-mono">{formatNumber(row.baselineFertilizer)}</span>,
    },
    { key: 'baselineFertilizerNames', header: 'ชนิดปุ๋ยปีฐานการผลิต', sortable: true },
    {
      key: 'projectFertilizer',
      header: 'ปุ๋ยปีการผลิตโครงการ',
      sortable: true,
      render: (row) => <span className="font-mono">{formatNumber(row.projectFertilizer)}</span>,
    },
    { key: 'projectFertilizerNames', header: 'ชนิดปุ๋ยปีการผลิตโครงการ', sortable: true },
    {
      key: 'fertilizerDiff',
      header: 'ผลต่างปุ๋ย',
      sortable: true,
      render: (row) => (
        <span className={row.fertilizerDiff >= 0 ? 'green-text font-medium' : 'red-text font-medium'}>
          {formatDiffText(row.fertilizerDiff, 'kg')}
        </span>
      ),
    },
    {
      key: 'baselineFuel',
      header: 'น้ำมันเฉลี่ยปีฐานการผลิต',
      sortable: true,
      render: (row) => <span className="font-mono">{formatNumber(row.baselineFuel)}</span>,
    },
    {
      key: 'projectFuel',
      header: 'น้ำมันปีการผลิตโครงการ',
      sortable: true,
      render: (row) => <span className="font-mono">{formatNumber(row.projectFuel)}</span>,
    },
    {
      key: 'fuelDiff',
      header: 'ผลต่างน้ำมัน',
      sortable: true,
      render: (row) => (
        <span className={row.fuelDiff >= 0 ? 'green-text font-medium' : 'red-text font-medium'}>
          {formatDiffText(row.fuelDiff, 'L')}
        </span>
      ),
    },
  ]

  const setSelection = (key: SelectionKey, value: string) => {
    setSelections((prev) => ({ ...prev, [key]: value }))
  }

  const summaryCards = [
    {
      key: 'projectYear',
      label: 'ปีการผลิตโครงการ',
      icon: <Calculator size={14} className="text-primary-500" />,
      value: selections.projectYear || 'ยังไม่เลือก',
      subtitle: 'ใช้เป็นส่วนที่ 5 ของการเปรียบเทียบ',
    },
    {
      key: 'baselineYears',
      label: 'ปีฐานการผลิตที่เลือก',
      icon: <Layers size={14} className="text-sky-500" />,
      value: BASELINE_KEYS.map((key) => selections[key]).filter(Boolean).join(', ') || 'ยังไม่เลือก',
      subtitle: 'เฉลี่ยจาก 4 ส่วนของปีฐานการผลิต',
    },
    {
      key: 'plotCount',
      label: 'แปลงที่มีข้อมูล',
      icon: <MapPin size={14} className="text-emerald-500" />,
      value: creditResult.totals.plotCount.toLocaleString('th-TH'),
      subtitle: 'รวมแปลงจากปีฐานการผลิตและปีการผลิตโครงการ',
    },
    {
      key: 'area',
      label: 'ไร่ปีการผลิตโครงการ',
      icon: <Tractor size={14} className="text-amber-500" />,
      value: `${formatNumber(creditResult.totals.projectArea)} ไร่`,
      subtitle: `เฉลี่ยปีฐานการผลิต ${formatNumber(creditResult.totals.baselineArea)} ไร่`,
    },
    {
      key: 'fertilizerDiff',
      label: 'ปุ๋ยเทียบปีฐานการผลิต',
      icon: <Sprout size={14} className="text-fuchsia-500" />,
      value: formatDiffText(creditResult.totals.fertilizerDiff, 'kg'),
      subtitle: `ปีฐานการผลิต ${formatNumber(creditResult.totals.baselineFertilizer)} · ปีโครงการ ${formatNumber(creditResult.totals.projectFertilizer)}`,
      valueClassName: creditResult.totals.fertilizerDiff >= 0 ? 'stat-value green-text' : 'stat-value red-text',
    },
    {
      key: 'fuelDiff',
      label: 'น้ำมันเทียบปีฐานการผลิต',
      icon: <Droplets size={14} className="text-cyan-500" />,
      value: formatDiffText(creditResult.totals.fuelDiff, 'L'),
      subtitle: `ปีฐานการผลิต ${formatNumber(creditResult.totals.baselineFuel)} · ปีโครงการ ${formatNumber(creditResult.totals.projectFuel)}`,
      valueClassName: creditResult.totals.fuelDiff >= 0 ? 'stat-value green-text' : 'stat-value red-text',
    },
  ]

  const pageQueryItems = [
    { label: 'ข้อมูลกิจกรรม', error },
  ]

  return (
    <div className="cf-dash">
      <div className="page active">
        <div className="card">
          <div className="page-header mb-0">
            <div>
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-surface-900"><Leaf size={20} className="text-primary-600 shrink-0" /> Carbon Credit</h1>
              <p className="page-subtitle">ใช้เฉพาะข้อมูลสถานะพร้อมคำนวณมาตรฐาน เพื่อเลือกปีฐานการผลิต 4 ส่วนและปีการผลิตโครงการ 1 ส่วนสำหรับเปรียบเทียบรายแปลง</p>
            </div>
            <div className="source-badge w-full justify-start md:w-auto md:justify-end">
              <span>Ready Only</span>
              <span>{readyDetails.length.toLocaleString('th-TH')} รายการพร้อมใช้งาน</span>
            </div>
          </div>
        </div>

        <DatabaseConnectionNotice
          items={pageQueryItems}
          className="mt-4"
          onRetry={() => { void qc.refetchQueries({ type: 'active' }) }}
        />

        <div className="card mt-5 min-w-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(91,164,255,0.14)]">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">ตั้งค่าปีฐานการผลิตและปีการผลิตโครงการ</h2>
              <p className="mt-1 text-xs text-surface-500">ส่วนที่ 1-4 ใช้เป็นปีฐานการผลิต ส่วนที่ 5 ใช้เป็นปีการผลิตโครงการ แล้วระบบจะเฉลี่ยปีฐานก่อนเทียบผล</p>
            </div>
            <button type="button" className="btn-ghost btn-sm w-full justify-center sm:w-auto" onClick={() => setSelections(EMPTY_SELECTIONS)}>
              ล้างการเลือกทั้งหมด
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            {(Object.keys(selections) as SelectionKey[]).map((key) => (
              <div key={key} className={`rounded-[20px] border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] ${key === 'projectYear' ? 'border-[#bfe6d7] bg-[linear-gradient(180deg,rgba(244,255,250,0.96),rgba(232,249,241,0.96))]' : 'border-[#d9e7f2] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(243,247,251,0.96))]'}`}>
                <label className="label">{SELECTION_LABELS[key]}</label>
                <select className="select mt-1" value={selections[key]} onChange={(event) => setSelection(key, event.target.value)}>
                  <option value="">— เลือกปีการผลิต —</option>
                  {availableYears.map((year) => (
                    <option key={`${key}-${year}`} value={String(year)}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {validationMessage && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 shadow-sm">
              {validationMessage}
            </div>
          )}

          {!validationMessage && !creditResult.rows.length && (
            <div className="mt-4 rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-600 shadow-sm">
              ไม่พบข้อมูลกิจกรรมที่ตรงกับปีการผลิตที่เลือกสำหรับ Carbon Credit
            </div>
          )}

        </div>

        {!validationMessage && creditResult.rows.length > 0 && (
          <>
            <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
              {summaryCards.map((card) => (
                <div key={card.key} className="stat-card relative overflow-hidden border border-[#d9e7f2] bg-white/90 backdrop-blur-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_18px_40px_rgba(91,164,255,0.18)]">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-300 via-blue-400 to-cyan-300" />
                  <div className="flex items-center gap-2">
                    {card.icon}
                    <span className="stat-label">{card.label}</span>
                  </div>
                  <p className={card.valueClassName ?? 'stat-value'}>{card.value}</p>
                  <p className="mt-2 text-xs text-surface-500">{card.subtitle}</p>
                </div>
              ))}
            </div>

            <div className="card mt-5 min-w-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(91,164,255,0.14)]">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">สรุป Carbon Credit รายแปลง</h2>
                  <p className="mt-1 text-xs text-surface-500">แสดงผลเฉลี่ยปีฐานการผลิตเทียบปีการผลิตโครงการ แยกปุ๋ยและน้ำมัน พร้อมชนิดปุ๋ยที่ใช้ในแต่ละแปลง</p>
                </div>
              </div>

              <DataTable
                data={creditResult.rows}
                columns={columns}
                isLoading={isLoading}
                rowKey={(row) => row.landId}
                searchPlaceholder="ค้นหาไร่ แปลง หรือชนิดปุ๋ย..."
                defaultPageSize={10}
                emptyMessage="ไม่พบข้อมูล Carbon Credit สำหรับเงื่อนไขนี้"
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
