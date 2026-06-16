import { useEffect, useMemo, useState, type WheelEvent as ReactWheelEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, BarChart3, Droplets, FileSpreadsheet, FlaskConical, GitCompare, Layers, Leaf, Maximize2, Minimize2, Plus, SlidersHorizontal, TriangleAlert, X } from 'lucide-react'
import * as XLSX from 'xlsx'
import { DatabaseConnectionNotice } from '@/components/ui/DatabaseConnectionNotice'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { get } from '@/lib/api'
import '../cf-dashboard.css'

type InputUsageBucket = 'fertilizer' | 'fuel' | 'other'
type FertilizerKind = 'chemical' | 'organic' | 'unknown'
type ViewMode = 'camp' | 'land'
type DensityMode = 'compact' | 'normal' | 'expanded'

interface FilterCampOption {
  id: number
  label: string
}

interface FilterLandOption {
  id: number
  label: string
  campId: number | null
  campLabel: string
}

interface InputUsageSummaryRow {
  id: string
  bucket: InputUsageBucket
  year: number | null
  caneTypeName?: string
  campId: number | null
  campName: string
  landId: number | null
  landCode: string
  landName: string
  landLabel: string
  itemName: string
  resourceTypeName: string
  fertilizerKind?: FertilizerKind
  fertilizerFormula?: string | null
  amount: number
  unit: string
  areaRai: number
  recordCount: number
  sourcePreparedCount: number
  warningCount: number
  warnings: string[]
}

interface InputUsageComparisonTarget {
  id: string
  type: ViewMode
  label: string
  campId: number | null
  campName: string
  landId?: number | null
  landLabel?: string
  areaRai: number
  recordCount: number
  fertilizerKg: number
  fuelLiter: number
  otherRecordCount: number
  topFertilizer: string
  topFuel: string
  warningCount: number
}

interface InputUsageSummaryResponse {
  filters: {
    years: number[]
    camps: FilterCampOption[]
    lands: FilterLandOption[]
  }
  totals: {
    campCount: number
    landCount: number
    recordCount: number
    areaRai: number
    fertilizerKg: number
    fuelLiter: number
    otherRecordCount: number
    unknownUnitCount: number
  }
  fertilizer: InputUsageSummaryRow[]
  fuel: InputUsageSummaryRow[]
  other: InputUsageSummaryRow[]
  comparisonTargets: InputUsageComparisonTarget[]
}

interface UsageTableRow {
  key: string
  targetLabel: string
  targetFullLabel: string
  yearLabel: string
  amountLabel: string
  perRaiLabel: string
  areaLabel: string
  recordCount: number
  itemCount: number
  topItem: string
  warningCount: number
  unit: string
}

type ChartItem = {
  name: string
  amount: number
}

type FertilizerWorkbookYearGroup = {
  key: string
  label: string
  year: number | null
  itemNames: string[]
}

type FertilizerWorkbookCell = {
  caneTypeName: string
  itemAmounts: Record<string, number>
  totalAmount: number
  areaRai: number
  warningCount: number
}

type FertilizerWorkbookRow = {
  key: string
  targetLabel: string
  targetSubLabel: string
  landCount: number
  yearCells: Record<string, FertilizerWorkbookCell>
}

const MAX_COMPARISON_TARGETS = 10

const FERTILIZER_KIND_OPTIONS: { value: '' | FertilizerKind; label: string }[] = [
  { value: '', label: 'ปุ๋ยทั้งหมด' },
  { value: 'chemical', label: 'ปุ๋ยเคมี' },
  { value: 'organic', label: 'ปุ๋ยอินทรีย์' },
  { value: 'unknown', label: 'ไม่ทราบสูตร' },
]

function formatNumber(value: number, digits = 1) {
  return value.toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })
}

function formatAmount(value: number, unit: string, digits = 1) {
  return `${formatNumber(value, digits)} ${unit}`
}

function densityGap(mode: DensityMode) {
  if (mode === 'compact') return 'gap-3'
  if (mode === 'expanded') return 'gap-6'
  return 'gap-4'
}

function densityPadding(mode: DensityMode) {
  if (mode === 'compact') return 'p-3'
  if (mode === 'expanded') return 'p-5'
  return 'p-4'
}

const DEFAULT_USAGE_TABLE_PAGE_SIZE = 5

function yearLabel(year: number | null) {
  return year == null ? 'ไม่ระบุปีการผลิต' : String(year)
}

function getCompactLandLabel(row: InputUsageSummaryRow) {
  const code = row.landCode?.trim()
  if (code) return code
  return row.landLabel || 'ไม่ระบุแปลง'
}

function getRowTargetId(row: InputUsageSummaryRow, mode: ViewMode) {
  if (mode === 'camp') return row.campId != null ? `camp:${row.campId}` : `camp:${row.campName}`
  return row.landId != null ? `land:${row.landId}` : `land:${row.landLabel}`
}

function getRowTargetLabel(row: InputUsageSummaryRow, mode: ViewMode) {
  return mode === 'camp' ? row.campName : row.landLabel
}

function getUsageTargetLabel(row: InputUsageSummaryRow, mode: ViewMode) {
  return mode === 'camp' ? row.campName : getCompactLandLabel(row)
}

function buildChartItems(rows: InputUsageSummaryRow[], limit = 8): ChartItem[] {
  const byItem = new Map<string, number>()
  rows.forEach((row) => {
    byItem.set(row.itemName, (byItem.get(row.itemName) ?? 0) + row.amount)
  })

  return Array.from(byItem.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
}

function sortWorkbookItemNames(left: string, right: string) {
  const leftNumber = Number(left.match(/(\d+(?:\.\d+)?)/)?.[1] ?? Number.NaN)
  const rightNumber = Number(right.match(/(\d+(?:\.\d+)?)/)?.[1] ?? Number.NaN)

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber
  }

  return left.localeCompare(right, 'th')
}

function buildFertilizerWorkbook(rows: InputUsageSummaryRow[], mode: ViewMode) {
  type InternalWorkbookCell = FertilizerWorkbookCell & {
    areaByLand: Map<string, number>
    caneTypeNames: Set<string>
  }

  type InternalWorkbookRow = {
    key: string
    targetLabel: string
    targetSubLabel: string
    landKeys: Set<string>
    yearCells: Record<string, InternalWorkbookCell>
  }

  const yearItems = new Map<string, Set<string>>()
  const workbookRows = new Map<string, InternalWorkbookRow>()
  const yearOrder = new Map<string, number>()

  rows.forEach((row) => {
    const yearKey = row.year == null ? 'unknown-year' : String(row.year)
    const rowKey = mode === 'camp'
      ? (row.campId != null ? `camp:${row.campId}` : `camp:${row.campName}`)
      : (row.landId != null ? `land:${row.landId}` : `${row.campName}|${getCompactLandLabel(row)}`)
    const landKey = row.landId != null ? `land:${row.landId}` : `${row.campName}|${getCompactLandLabel(row)}`
    const itemSet = yearItems.get(yearKey) ?? new Set<string>()
    itemSet.add(row.itemName)
    yearItems.set(yearKey, itemSet)
    yearOrder.set(yearKey, row.year ?? Number.MAX_SAFE_INTEGER)

    const workbookRow = workbookRows.get(rowKey) ?? {
      key: rowKey,
      targetLabel: mode === 'camp' ? row.campName : getCompactLandLabel(row),
      targetSubLabel: mode === 'camp' ? 'รวมหลายแปลง' : row.campName,
      landKeys: new Set<string>(),
      yearCells: {},
    }

    const cell = workbookRow.yearCells[yearKey] ?? {
      caneTypeName: '—',
      itemAmounts: {},
      totalAmount: 0,
      areaRai: 0,
      warningCount: 0,
      areaByLand: new Map<string, number>(),
      caneTypeNames: new Set<string>(),
    }

    const caneTypeName = row.caneTypeName?.trim()
    if (caneTypeName) cell.caneTypeNames.add(caneTypeName)
    cell.itemAmounts[row.itemName] = (cell.itemAmounts[row.itemName] ?? 0) + row.amount
    cell.totalAmount += row.amount
    cell.areaByLand.set(landKey, Math.max(cell.areaByLand.get(landKey) ?? 0, row.areaRai))
    cell.areaRai = Array.from(cell.areaByLand.values()).reduce((sum, value) => sum + value, 0)
    cell.warningCount += row.warningCount
    cell.caneTypeName = cell.caneTypeNames.size ? Array.from(cell.caneTypeNames).join(', ') : '—'
    workbookRow.landKeys.add(landKey)
    workbookRow.yearCells[yearKey] = cell
    workbookRows.set(rowKey, workbookRow)
  })

  const years: FertilizerWorkbookYearGroup[] = Array.from(yearItems.entries())
    .map(([key, itemNames]) => ({
      key,
      label: key === 'unknown-year' ? 'ไม่ระบุปีการผลิต' : key,
      year: key === 'unknown-year' ? null : Number(key),
      itemNames: Array.from(itemNames).sort(sortWorkbookItemNames),
    }))
    .sort((left, right) => {
      const leftYear = yearOrder.get(left.key) ?? Number.MAX_SAFE_INTEGER
      const rightYear = yearOrder.get(right.key) ?? Number.MAX_SAFE_INTEGER
      return leftYear - rightYear
    })

  const workbookRowList: FertilizerWorkbookRow[] = Array.from(workbookRows.values())
    .map((row) => ({
      key: row.key,
      targetLabel: row.targetLabel,
      targetSubLabel: mode === 'camp' ? `${row.landKeys.size.toLocaleString('th-TH')} แปลง` : row.targetSubLabel,
      landCount: row.landKeys.size,
      yearCells: Object.fromEntries(Object.entries(row.yearCells).map(([key, cell]) => [key, {
        caneTypeName: cell.caneTypeName,
        itemAmounts: cell.itemAmounts,
        totalAmount: cell.totalAmount,
        areaRai: cell.areaRai,
        warningCount: cell.warningCount,
      } satisfies FertilizerWorkbookCell])),
    }))
    .sort((left, right) => left.targetLabel.localeCompare(right.targetLabel, 'th', { numeric: true }))

  return {
    years,
    rows: workbookRowList,
  }
}

function buildUsageTableRows(rows: InputUsageSummaryRow[], mode: ViewMode, unit: string): UsageTableRow[] {
  type InternalRow = UsageTableRow & {
    amount: number
    areaByLand: Map<string, number>
    itemAmounts: Map<string, number>
  }

  const map = new Map<string, InternalRow>()

  rows.forEach((row) => {
    const targetId = getRowTargetId(row, mode)
    const key = `${targetId}|${row.year ?? 'unknown'}`
    const existing = map.get(key) ?? {
      key,
      targetLabel: getUsageTargetLabel(row, mode),
      targetFullLabel: getRowTargetLabel(row, mode),
      yearLabel: yearLabel(row.year),
      amountLabel: '',
      perRaiLabel: '',
      areaLabel: '',
      recordCount: 0,
      itemCount: 0,
      topItem: '—',
      warningCount: 0,
      unit,
      amount: 0,
      areaByLand: new Map<string, number>(),
      itemAmounts: new Map<string, number>(),
    }

    existing.amount += row.amount
    existing.recordCount += row.recordCount
    existing.warningCount += row.warningCount
    existing.itemAmounts.set(row.itemName, (existing.itemAmounts.get(row.itemName) ?? 0) + row.amount)
    const landKey = row.landId != null ? String(row.landId) : row.landLabel
    existing.areaByLand.set(landKey, Math.max(existing.areaByLand.get(landKey) ?? 0, row.areaRai))
    map.set(key, existing)
  })

  return Array.from(map.values())
    .map((row) => {
      const area = Array.from(row.areaByLand.values()).reduce((sum, value) => sum + value, 0)
      const topItem = Array.from(row.itemAmounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
      return {
        key: row.key,
        targetLabel: row.targetLabel,
        targetFullLabel: row.targetFullLabel,
        yearLabel: row.yearLabel,
        amountLabel: formatAmount(row.amount, unit, unit === 'kg' ? 1 : 2),
        perRaiLabel: area > 0 ? formatAmount(row.amount / area, `${unit}/ไร่`, 2) : '—',
        areaLabel: `${formatNumber(area, 2)} ไร่`,
        recordCount: row.recordCount,
        itemCount: row.itemAmounts.size,
        topItem,
        warningCount: row.warningCount,
        unit,
      }
    })
    .sort((a, b) => b.recordCount - a.recordCount || a.targetLabel.localeCompare(b.targetLabel, 'th'))
}

function buildComparisonTargets(rows: InputUsageSummaryRow[], type: ViewMode): InputUsageComparisonTarget[] {
  type InternalTarget = InputUsageComparisonTarget & {
    areaByLand: Map<string, number>
    fertilizerItems: Map<string, number>
    fuelItems: Map<string, number>
  }

  const map = new Map<string, InternalTarget>()

  rows.forEach((row) => {
    const id = getRowTargetId(row, type)
    const existing = map.get(id) ?? {
      id,
      type,
      label: getRowTargetLabel(row, type),
      campId: row.campId,
      campName: row.campName,
      landId: type === 'land' ? row.landId : undefined,
      landLabel: type === 'land' ? row.landLabel : undefined,
      areaRai: 0,
      recordCount: 0,
      fertilizerKg: 0,
      fuelLiter: 0,
      otherRecordCount: 0,
      topFertilizer: '—',
      topFuel: '—',
      warningCount: 0,
      areaByLand: new Map<string, number>(),
      fertilizerItems: new Map<string, number>(),
      fuelItems: new Map<string, number>(),
    }

    existing.recordCount += row.recordCount
    existing.warningCount += row.warningCount
    const landKey = row.landId != null ? String(row.landId) : row.landLabel
    existing.areaByLand.set(landKey, Math.max(existing.areaByLand.get(landKey) ?? 0, row.areaRai))

    if (row.bucket === 'fertilizer') {
      existing.fertilizerKg += row.amount
      existing.fertilizerItems.set(row.itemName, (existing.fertilizerItems.get(row.itemName) ?? 0) + row.amount)
    } else if (row.bucket === 'fuel') {
      existing.fuelLiter += row.amount
      existing.fuelItems.set(row.itemName, (existing.fuelItems.get(row.itemName) ?? 0) + row.amount)
    } else {
      existing.otherRecordCount += row.recordCount
    }

    map.set(id, existing)
  })

  return Array.from(map.values())
    .map((target) => ({
      id: target.id,
      type: target.type,
      label: target.label,
      campId: target.campId,
      campName: target.campName,
      landId: target.landId,
      landLabel: target.landLabel,
      areaRai: Array.from(target.areaByLand.values()).reduce((sum, value) => sum + value, 0),
      recordCount: target.recordCount,
      fertilizerKg: target.fertilizerKg,
      fuelLiter: target.fuelLiter,
      otherRecordCount: target.otherRecordCount,
      topFertilizer: Array.from(target.fertilizerItems.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—',
      topFuel: Array.from(target.fuelItems.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—',
      warningCount: target.warningCount,
    }))
    .sort((a, b) => b.recordCount - a.recordCount || a.label.localeCompare(b.label, 'th'))
}

function summarizeVisibleRows(rows: InputUsageSummaryRow[]) {
  const campIds = new Set<number>()
  const landIds = new Set<number>()
  const areaByLand = new Map<string, number>()

  rows.forEach((row) => {
    if (row.campId != null) campIds.add(row.campId)
    if (row.landId != null) landIds.add(row.landId)
    const landKey = row.landId != null ? String(row.landId) : row.landLabel
    areaByLand.set(landKey, Math.max(areaByLand.get(landKey) ?? 0, row.areaRai))
  })

  return {
    campCount: campIds.size,
    landCount: landIds.size,
    areaRai: Array.from(areaByLand.values()).reduce((sum, value) => sum + value, 0),
    recordCount: rows.reduce((sum, row) => sum + row.recordCount, 0),
    fertilizerKg: rows.filter((row) => row.bucket === 'fertilizer').reduce((sum, row) => sum + row.amount, 0),
    fuelLiter: rows.filter((row) => row.bucket === 'fuel').reduce((sum, row) => sum + row.amount, 0),
    warningCount: rows.reduce((sum, row) => sum + row.warningCount, 0),
  }
}

function buildFertilizerWorkbookSheetRows(
  workbook: { years: FertilizerWorkbookYearGroup[]; rows: FertilizerWorkbookRow[] },
  mode: ViewMode,
) {
  const targetHeader = mode === 'camp' ? 'ไร่ / Camp' : 'เลขแปลง'
  const subHeader = mode === 'camp' ? 'จำนวนแปลง' : 'ไร่ / Camp'
  const firstHeader: Array<string | number> = [targetHeader, subHeader]
  const secondHeader: Array<string | number> = ['', '']

  workbook.years.forEach((year) => {
    const colSpan = year.itemNames.length + 4
    firstHeader.push(`ปีการผลิต ${year.label}`, ...Array(Math.max(colSpan - 1, 0)).fill(''))
    secondHeader.push('ประเภทอ้อย', ...year.itemNames, 'รวม(กก.)', 'พื้นที่ (ไร่)', 'Warning')
  })

  const bodyRows = workbook.rows.map((row) => {
    const cells: Array<string | number> = [row.targetLabel, row.targetSubLabel]
    workbook.years.forEach((year) => {
      const cell = row.yearCells[year.key]
      cells.push(
        cell?.caneTypeName || '',
        ...year.itemNames.map((itemName) => cell?.itemAmounts[itemName] ?? ''),
        cell?.totalAmount ?? '',
        cell?.areaRai ?? '',
        cell?.warningCount ?? '',
      )
    })
    return cells
  })

  return [firstHeader, secondHeader, ...bodyRows]
}

function buildFertilizerSummarySheetRows(rows: UsageTableRow[], mode: ViewMode) {
  const targetHeader = mode === 'camp' ? 'ไร่ / Camp' : 'เลขแปลง'
  return rows.map((row) => ({
    [targetHeader]: row.targetLabel,
    ...(mode === 'land' ? { 'ชื่อแปลงเดิม': row.targetFullLabel } : {}),
    'ปีการผลิต': row.yearLabel,
    'ปริมาณรวม': row.amountLabel,
    'ต่อไร่': row.perRaiLabel,
    'พื้นที่': row.areaLabel,
    Record: row.recordCount,
    'จำนวนรายการ': row.itemCount,
    'รายการหลัก': row.topItem,
    Warning: row.warningCount,
  }))
}

function UsageBars({ rows, unit, emptyLabel }: { rows: ChartItem[]; unit: string; emptyLabel: string }) {
  const max = Math.max(...rows.map((row) => row.amount), 0)

  if (!rows.length || max <= 0) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-surface-200 bg-surface-50 text-sm text-surface-500">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const width = `${Math.max((row.amount / max) * 100, 3)}%`
        return (
          <div key={row.name} className="grid grid-cols-[minmax(120px,1fr)_minmax(150px,2fr)_92px] items-center gap-3 text-xs">
            <div className="min-w-0 truncate font-medium text-surface-700" title={row.name}>{row.name}</div>
            <div className="h-3 overflow-hidden rounded-full bg-surface-100">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-amber-300" style={{ width }} />
            </div>
            <div className="text-right font-mono text-surface-700">{formatAmount(row.amount, unit, unit === 'kg' ? 1 : 2)}</div>
          </div>
        )
      })}
    </div>
  )
}

function FertilizerWorkbookTable({
  years,
  rows,
  mode,
}: {
  years: FertilizerWorkbookYearGroup[]
  rows: FertilizerWorkbookRow[]
  mode: ViewMode
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.shiftKey) return
    event.preventDefault()
    event.currentTarget.scrollLeft += event.deltaY + event.deltaX
  }

  if (!years.length || !rows.length) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-[18px] border border-dashed border-emerald-200 bg-white/90 text-sm text-surface-500">
        ยังไม่มีข้อมูลปุ๋ยเพียงพอสำหรับสร้างตารางแบบไฟล์ตัวอย่าง
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[18px] border border-[#b8d8c2] bg-white shadow-sm">
      <div className="border-b border-[#d8eadf] bg-[linear-gradient(180deg,rgba(244,252,246,1),rgba(234,246,238,1))] px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-surface-900">ตารางปุ๋ยแบบอ้างอิงไฟล์ตัวอย่าง</h3>
            <p className="mt-1 text-xs text-surface-500">
              จัดคอลัมน์ตามปีการผลิตและรายการปุ๋ย โดยแถวจะเปลี่ยนตามมุมมอง{mode === 'camp' ? 'รายไร่' : 'รายแปลง'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-800">
              <ArrowLeftRight size={12} /> Shift + Wheel = ซ้าย/ขวา
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-50"
              onClick={() => setIsExpanded((current) => !current)}
            >
              {isExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              {isExpanded ? 'ย่อกรอบตาราง' : 'ขยายกรอบตาราง'}
            </button>
          </div>
        </div>
      </div>
      <div
        className={`resize-y overflow-auto overscroll-contain ${isExpanded ? 'h-[78vh]' : 'h-[460px]'}`}
        onWheel={handleWheel}
      >
        <table className="min-w-[1400px] border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th rowSpan={2} className="sticky left-0 top-0 z-30 border-b border-r border-[#d6e6ef] bg-[#eef5fb] px-4 py-3 text-left font-semibold text-surface-700">
                {mode === 'camp' ? 'ไร่ / Camp' : 'เลขแปลง'}
              </th>
              {years.map((year) => (
                <th
                  key={year.key}
                  colSpan={year.itemNames.length + 4}
                  className="sticky top-0 z-20 border-b border-r border-[#bfd7c7] bg-[#dff2e6] px-3 py-3 text-center font-semibold text-emerald-900"
                >
                  ปีการผลิต {year.label}
                </th>
              ))}
            </tr>
            <tr>
              {years.flatMap((year) => ([
                <th key={`${year.key}:cane`} className="sticky top-[46px] z-20 min-w-[130px] border-b border-r border-[#d6e6ef] bg-[#f4faf6] px-3 py-2 text-left font-medium text-surface-600">ประเภทอ้อย</th>,
                ...year.itemNames.map((itemName) => (
                  <th
                    key={`${year.key}:${itemName}`}
                    className="sticky top-[46px] z-20 min-w-[180px] max-w-[220px] border-b border-r border-[#d6e6ef] bg-[#f4faf6] px-3 py-2 text-left font-medium leading-5 text-surface-600 whitespace-normal break-words"
                    title={itemName}
                  >
                    {itemName}
                  </th>
                )),
                <th key={`${year.key}:total`} className="sticky top-[46px] z-20 min-w-[110px] border-b border-r border-[#d6e6ef] bg-[#eef8f1] px-3 py-2 text-center font-semibold text-emerald-900">รวม(กก.)</th>,
                <th key={`${year.key}:area`} className="sticky top-[46px] z-20 min-w-[110px] border-b border-r border-[#d6e6ef] bg-[#eef8f1] px-3 py-2 text-center font-semibold text-emerald-900">พื้นที่ (ไร่)</th>,
                <th key={`${year.key}:warning`} className="sticky top-[46px] z-20 min-w-[100px] border-b border-r border-[#d6e6ef] bg-[#fff7e8] px-3 py-2 text-center font-semibold text-amber-800">Warning</th>,
              ]))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.key} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-[#fbfdfb]'}>
                <td className={`sticky left-0 z-20 border-b border-r border-[#e0ebf2] bg-inherit px-4 py-3 text-surface-700 whitespace-normal break-words ${mode === 'camp' ? 'min-w-[220px] max-w-[320px]' : 'min-w-[140px] max-w-[180px]'}`}>
                  <div className="font-medium text-surface-800">{row.targetLabel}</div>
                  <div className="mt-1 text-[11px] text-surface-500">{row.targetSubLabel}</div>
                </td>
                {years.flatMap((year) => {
                  const cell = row.yearCells[year.key]
                  return [
                    <td key={`${row.key}:${year.key}:cane`} className="border-b border-r border-[#e0ebf2] px-3 py-3 text-surface-600">
                      {cell?.caneTypeName || '—'}
                    </td>,
                    ...year.itemNames.map((itemName) => (
                      <td key={`${row.key}:${year.key}:${itemName}`} className="border-b border-r border-[#e0ebf2] px-3 py-3 text-right font-mono text-surface-700">
                        {cell?.itemAmounts[itemName] ? formatNumber(cell.itemAmounts[itemName], 1) : '—'}
                      </td>
                    )),
                    <td key={`${row.key}:${year.key}:total`} className="border-b border-r border-[#e0ebf2] bg-[#f7fcf8] px-3 py-3 text-right font-mono font-semibold text-emerald-800">
                      {cell?.totalAmount ? formatNumber(cell.totalAmount, 1) : '—'}
                    </td>,
                    <td key={`${row.key}:${year.key}:area`} className="border-b border-r border-[#e0ebf2] bg-[#f7fcf8] px-3 py-3 text-right font-mono text-surface-700">
                      {cell?.areaRai ? formatNumber(cell.areaRai, 2) : '—'}
                    </td>,
                    <td key={`${row.key}:${year.key}:warning`} className="border-b border-r border-[#e0ebf2] bg-[#fffdfa] px-3 py-3 text-center">
                      {cell?.warningCount ? <span className="badge-amber">{cell.warningCount}</span> : '—'}
                    </td>,
                  ]
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function InputUsageSummaryPage() {
  const qc = useQueryClient()
  const [yearFilters, setYearFilters] = useState<string[]>([])
  const [campFilter, setCampFilter] = useState('')
  const [landFilter, setLandFilter] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('camp')
  const density: DensityMode = 'expanded'
  const [fertilizerKindFilter, setFertilizerKindFilter] = useState<'' | FertilizerKind>('')
  const [comparisonType, setComparisonType] = useState<ViewMode>('camp')
  const [comparisonIds, setComparisonIds] = useState<string[]>(['', ''])

  const { data, isLoading, error } = useQuery({
    queryKey: ['input-usage-summary'],
    queryFn: () => get<InputUsageSummaryResponse>('/activities/input-usage-summary'),
  })

  const pageQueryItems = [
    { label: 'สรุปการใช้ปัจจัย', error },
  ]

  const availableYears = data?.filters.years ?? []
  const selectedYearNumbers = useMemo(() => yearFilters.map((year) => Number(year)), [yearFilters])
  const selectedYearSummary = yearFilters.length
    ? `เลือก ${yearFilters.length.toLocaleString('th-TH')} ปี: ${yearFilters.join(', ')}`
    : 'แสดงทุกปีการผลิต'

  const visibleLands = useMemo(() => {
    const lands = data?.filters.lands ?? []
    if (!campFilter) return lands
    return lands.filter((land) => land.campId === Number(campFilter))
  }, [campFilter, data?.filters.lands])

  useEffect(() => {
    if (!landFilter) return
    if (visibleLands.some((land) => land.id === Number(landFilter))) return
    setLandFilter('')
  }, [landFilter, visibleLands])

  const matchesBaseFilters = (row: InputUsageSummaryRow) => (
    (!selectedYearNumbers.length || (row.year != null && selectedYearNumbers.includes(row.year)))
    && (!campFilter || row.campId === Number(campFilter))
    && (!landFilter || row.landId === Number(landFilter))
  )

  const visibleFertilizerRows = useMemo(() => (
    (data?.fertilizer ?? []).filter((row) => matchesBaseFilters(row) && (!fertilizerKindFilter || row.fertilizerKind === fertilizerKindFilter))
  ), [campFilter, data?.fertilizer, fertilizerKindFilter, landFilter, selectedYearNumbers])

  const visibleFuelRows = useMemo(() => (
    (data?.fuel ?? []).filter(matchesBaseFilters)
  ), [campFilter, data?.fuel, landFilter, selectedYearNumbers])

  const visibleOtherRows = useMemo(() => (
    (data?.other ?? []).filter(matchesBaseFilters)
  ), [campFilter, data?.other, landFilter, selectedYearNumbers])

  const allVisibleRows = useMemo(() => [
    ...visibleFertilizerRows,
    ...visibleFuelRows,
    ...visibleOtherRows,
  ], [visibleFertilizerRows, visibleFuelRows, visibleOtherRows])

  const visibleTotals = useMemo(() => summarizeVisibleRows(allVisibleRows), [allVisibleRows])
  const fertilizerChartRows = useMemo(() => buildChartItems(visibleFertilizerRows, 8), [visibleFertilizerRows])
  const fuelChartRows = useMemo(() => buildChartItems(visibleFuelRows, 8), [visibleFuelRows])
  const fertilizerTableRows = useMemo(() => buildUsageTableRows(visibleFertilizerRows, viewMode, 'kg'), [viewMode, visibleFertilizerRows])
  const fuelTableRows = useMemo(() => buildUsageTableRows(visibleFuelRows, viewMode, 'L'), [viewMode, visibleFuelRows])
  const fertilizerWorkbook = useMemo(() => buildFertilizerWorkbook(visibleFertilizerRows, viewMode), [viewMode, visibleFertilizerRows])
  const comparisonOptions = useMemo(() => buildComparisonTargets(allVisibleRows, comparisonType), [allVisibleRows, comparisonType])

  useEffect(() => {
    setComparisonIds((prev) => {
      const optionIds = new Set(comparisonOptions.map((option) => option.id))
      const next = prev.filter((id) => id && optionIds.has(id)).slice(0, MAX_COMPARISON_TARGETS)
      comparisonOptions.forEach((option) => {
        if (next.length >= 2) return
        if (!next.includes(option.id)) next.push(option.id)
      })
      while (next.length < 2) next.push('')
      return next.join('|') === prev.join('|') ? prev : next
    })
  }, [comparisonOptions])

  const comparisonTargets = comparisonIds
    .map((id) => comparisonOptions.find((option) => option.id === id))
    .filter((item): item is InputUsageComparisonTarget => Boolean(item))
  const comparisonBase = comparisonTargets[0]

  const usageColumns: Column<UsageTableRow>[] = [
    {
      key: 'targetLabel',
      header: viewMode === 'camp' ? 'ไร่ / Camp' : 'เลขแปลง',
      sortable: true,
      minWidth: viewMode === 'camp' ? '180px' : '120px',
      render: (row) => <span title={row.targetFullLabel}>{row.targetLabel}</span>,
    },
    { key: 'yearLabel', header: 'ปีการผลิต', sortable: true, width: '110px' },
    { key: 'amountLabel', header: 'ปริมาณรวม', sortable: true, sortValue: (row) => Number(row.amountLabel.replace(/[^\d.-]/g, '')), width: '140px' },
    { key: 'perRaiLabel', header: 'ต่อไร่', sortable: true, width: '130px' },
    { key: 'areaLabel', header: 'พื้นที่', sortable: true, width: '120px' },
    { key: 'recordCount', header: 'Record', sortable: true, width: '90px' },
    { key: 'itemCount', header: 'รายการ', sortable: true, width: '90px' },
    { key: 'topItem', header: 'รายการหลัก', sortable: true, minWidth: '180px' },
    {
      key: 'warningCount',
      header: 'Warning',
      sortable: true,
      width: '100px',
      render: (row) => row.warningCount ? <span className="badge-amber">{row.warningCount}</span> : '—',
    },
  ]

  const otherColumns: Column<InputUsageSummaryRow>[] = [
    { key: viewMode === 'camp' ? 'campName' : 'landLabel', header: viewMode === 'camp' ? 'ไร่ / Camp' : 'แปลง', sortable: true, minWidth: '180px', render: (row) => viewMode === 'camp' ? row.campName : row.landLabel },
    { key: 'year', header: 'ปีการผลิต', sortable: true, width: '110px', render: (row) => yearLabel(row.year) },
    { key: 'resourceTypeName', header: 'ประเภท', sortable: true, minWidth: '140px' },
    { key: 'itemName', header: 'รายการ', sortable: true, minWidth: '180px' },
    { key: 'amount', header: 'ปริมาณ', sortable: true, width: '130px', render: (row) => formatAmount(row.amount, row.unit, 2) },
    { key: 'recordCount', header: 'Record', sortable: true, width: '90px' },
    { key: 'warningCount', header: 'Warning', sortable: true, width: '100px', render: (row) => row.warningCount ? <span className="badge-amber">{row.warningCount}</span> : '—' },
  ]

  const addComparisonTarget = () => {
    if (comparisonIds.length >= MAX_COMPARISON_TARGETS) return
    const nextId = comparisonOptions.find((option) => !comparisonIds.includes(option.id))?.id ?? ''
    setComparisonIds((prev) => [...prev, nextId])
  }

  const removeComparisonTarget = (index: number) => {
    setComparisonIds((prev) => prev.length <= 2 ? prev : prev.filter((_, itemIndex) => itemIndex !== index))
  }

  const setComparisonTarget = (index: number, value: string) => {
    setComparisonIds((prev) => prev.map((item, itemIndex) => itemIndex === index ? value : item))
  }

  const toggleYearFilter = (year: number) => {
    const value = String(year)
    setYearFilters((prev) => (
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value].sort((left, right) => Number(left) - Number(right))
    ))
  }

  const exportFertilizerExcel = () => {
    const wb = XLSX.utils.book_new()

    if (fertilizerWorkbook.rows.length && fertilizerWorkbook.years.length) {
      const workbookSheet = XLSX.utils.aoa_to_sheet(buildFertilizerWorkbookSheetRows(fertilizerWorkbook, viewMode))
      workbookSheet['!cols'] = [
        { wch: viewMode === 'camp' ? 28 : 16 },
        { wch: viewMode === 'camp' ? 14 : 24 },
        ...fertilizerWorkbook.years.flatMap((year) => [
          { wch: 18 },
          ...year.itemNames.map(() => ({ wch: 22 })),
          { wch: 14 },
          { wch: 14 },
          { wch: 10 },
        ]),
      ]
      XLSX.utils.book_append_sheet(wb, workbookSheet, 'Fertilizer Workbook')
    }

    if (fertilizerTableRows.length) {
      const summarySheet = XLSX.utils.json_to_sheet(buildFertilizerSummarySheetRows(fertilizerTableRows, viewMode))
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Fertilizer Summary')
    }

    if (!wb.SheetNames.length) return
    const viewLabel = viewMode === 'camp' ? 'camp' : 'land'
    const dateLabel = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `input-usage-fertilizer-${viewLabel}-${dateLabel}.xlsx`)
  }

  return (
    <div className="cf-dash">
      <div className="page active">
        <div className="overflow-hidden rounded-[22px] border border-[#d8e7f5] bg-[radial-gradient(circle_at_top_left,rgba(224,242,255,0.82),transparent_26%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(246,250,255,0.98))] p-4 shadow-sm">
          <div className="page-header mb-0">
            <div className="relative space-y-2.5 pr-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#c8def0] bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-800">
                <BarChart3 size={14} className="text-primary-600" /> Carbon Input Overview
              </div>
              <div className="space-y-2 text-left">
                <h1 className="page-title ml-auto flex w-full items-start justify-end gap-2 text-right text-lg font-semibold leading-tight text-surface-900 sm:text-xl">
                  <span className="block">สรุปการใช้ปัจจัย</span>
                </h1>
                <p className="page-subtitle max-w-3xl text-left text-sm leading-6">
                  ภาพรวมการใช้ปุ๋ย น้ำมัน และปัจจัยอื่น ๆ ตามไร่ แปลง และปีการผลิต ก่อนเข้าสู่ Carbon Footprint
                  โดยส่วนปุ๋ยจะมีมุมมองแบบ workbook เพื่อให้อ่านใกล้เคียงไฟล์ตัวอย่างมากขึ้น
                </p>
              </div>
              <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 rounded-full border border-[#c8def0] bg-white/90 p-2 shadow-sm">
                <BarChart3 size={18} className="text-primary-600" />
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] text-surface-600">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium">ปุ๋ย: มุมมองคล้าย xlsx</span>
                <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 font-medium">น้ำมัน: ใช้ filter ร่วมกัน</span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-medium">Warning: หน่วยที่แปลงไม่ได้</span>
              </div>
            </div>
          </div>
        </div>

        <DatabaseConnectionNotice
          items={pageQueryItems}
          className="mb-2"
          onRetry={() => { void qc.refetchQueries({ queryKey: ['input-usage-summary'] }) }}
        />

        <section className={`rounded-[24px] border border-[#cfe0ef] bg-[linear-gradient(180deg,rgba(248,252,255,0.98),rgba(239,246,253,0.96))] shadow-sm ${densityPadding(density)}`}>
          <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-surface-900">ตัวกรองร่วมของทั้งหน้า</div>
              <p className="text-xs text-surface-500">ทุกส่วนจะใช้ปีการผลิต ไร่ แปลง และมุมมองเดียวกัน เพื่อให้เทียบข้อมูลระหว่างปุ๋ย น้ำมัน และปัจจัยอื่นได้ตรงกัน</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#cfe0ef] bg-white/80 px-3 py-1 text-[11px] font-medium text-surface-600">
              <SlidersHorizontal size={13} className="text-primary-600" /> Shared Filter Workspace
            </div>
          </div>
          <div className={`grid grid-cols-1 ${densityGap(density)} md:grid-cols-2 xl:grid-cols-5`}>
            <div>
              <label className="label">ปีการผลิต</label>
              <div className="rounded-xl border border-surface-200 bg-white/90 p-2 shadow-inner">
                <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1">
                  <button
                    type="button"
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${yearFilters.length === 0 ? 'border-primary-500 bg-primary-600 text-white' : 'border-surface-200 bg-surface-50 text-surface-600 hover:border-primary-200'}`}
                    onClick={() => setYearFilters([])}
                  >
                    ทุกปี
                  </button>
                  {availableYears.map((year) => {
                    const value = String(year)
                    const selected = yearFilters.includes(value)
                    return (
                      <button
                        key={year}
                        type="button"
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${selected ? 'border-primary-500 bg-primary-600 text-white' : 'border-surface-200 bg-white text-surface-600 hover:border-primary-200 hover:bg-primary-50'}`}
                        onClick={() => toggleYearFilter(year)}
                      >
                        {year}
                      </button>
                    )
                  })}
                </div>
              </div>
              <p className="mt-1 text-[11px] text-surface-500">{selectedYearSummary}</p>
            </div>
            <div>
              <label className="label">ไร่ / Camp</label>
              <select className="select" value={campFilter} onChange={(event) => setCampFilter(event.target.value)}>
                <option value="">ทุกไร่</option>
                {(data?.filters.camps ?? []).map((camp) => <option key={camp.id} value={camp.id}>{camp.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">แปลง</label>
              <select className="select" value={landFilter} onChange={(event) => setLandFilter(event.target.value)}>
                <option value="">ทุกแปลง</option>
                {visibleLands.map((land) => <option key={land.id} value={land.id}>{land.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">มุมมองตาราง</label>
              <div className="grid grid-cols-2 rounded-xl border border-surface-200 bg-surface-50 p-1">
                {(['camp', 'land'] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${viewMode === mode ? 'bg-white text-primary-700 shadow-sm' : 'text-surface-500'}`}
                    onClick={() => setViewMode(mode)}
                  >
                    {mode === 'camp' ? 'รายไร่' : 'รายแปลง'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                className="btn-ghost w-full justify-center"
                onClick={() => {
                  setYearFilters([])
                  setCampFilter('')
                  setLandFilter('')
                  setFertilizerKindFilter('')
                }}
              >
                <SlidersHorizontal size={14} /> ล้างตัวกรอง
              </button>
            </div>
          </div>
        </section>

        <section className={`grid grid-cols-1 ${densityGap(density)} md:grid-cols-2 xl:grid-cols-5`}>
          {[
            {
              label: 'ปุ๋ยรวม',
              value: formatAmount(visibleTotals.fertilizerKg, 'kg', 1),
              icon: <Leaf size={15} className="text-emerald-700" />,
              className: 'border-emerald-200 bg-[linear-gradient(180deg,rgba(246,255,249,0.98),rgba(236,250,241,0.98))]',
            },
            {
              label: 'น้ำมันรวม',
              value: formatAmount(visibleTotals.fuelLiter, 'L', 2),
              icon: <Droplets size={15} className="text-sky-700" />,
              className: 'border-sky-200 bg-[linear-gradient(180deg,rgba(247,252,255,0.98),rgba(236,246,254,0.98))]',
            },
            {
              label: 'แปลงที่เกี่ยวข้อง',
              value: `${visibleTotals.landCount.toLocaleString('th-TH')} แปลง`,
              icon: <Layers size={15} className="text-violet-700" />,
              className: 'border-violet-200 bg-[linear-gradient(180deg,rgba(251,249,255,0.98),rgba(243,239,255,0.98))]',
            },
            {
              label: 'พื้นที่รวม',
              value: `${formatNumber(visibleTotals.areaRai, 2)} ไร่`,
              icon: <BarChart3 size={15} className="text-amber-700" />,
              className: 'border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,244,0.98),rgba(255,245,226,0.98))]',
            },
            {
              label: 'Record ที่ใช้สรุป',
              value: visibleTotals.recordCount.toLocaleString('th-TH'),
              icon: <FlaskConical size={15} className="text-cyan-700" />,
              className: 'border-cyan-200 bg-[linear-gradient(180deg,rgba(244,254,255,0.98),rgba(232,249,251,0.98))]',
            },
          ].map((card) => (
            <div key={card.label} className={`rounded-[20px] border shadow-sm ${card.className} ${densityPadding(density)}`}>
              <div className="mb-2 flex items-center gap-2 text-xs text-surface-500">{card.icon}<span>{card.label}</span></div>
              <div className="font-mono text-xl font-bold text-surface-900">{card.value}</div>
            </div>
          ))}
        </section>

        {visibleTotals.warningCount > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <div className="flex items-start gap-2">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              <span>มี {visibleTotals.warningCount.toLocaleString('th-TH')} รายการที่หน่วยยังแปลงไม่ได้ ระบบจึงไม่นำปริมาณนั้นไปรวมใน kg/L เพื่อป้องกันผลรวมผิด</span>
            </div>
          </div>
        )}

        <section className={`rounded-[26px] border border-emerald-200 bg-[linear-gradient(180deg,rgba(248,255,250,0.98),rgba(235,249,241,0.98))] shadow-sm ${densityPadding(density)}`}>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-[11px] font-semibold text-emerald-800">
                <Leaf size={14} className="text-emerald-700" /> Section 1
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-surface-900"><Leaf size={16} className="text-emerald-700" /> ส่วนที่ 1: ปุ๋ย</div>
              <p className="text-xs text-surface-500">รวมเป็น kg แยกประเภทปุ๋ยจากชื่อสูตรหรือคำสำคัญ และมีตารางแบบ workbook เพื่อให้อ่านใกล้เคียงไฟล์ xlsx ตัวอย่าง</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {FERTILIZER_KIND_OPTIONS.map((option) => (
                <button
                  key={option.value || 'all'}
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${fertilizerKindFilter === option.value ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-emerald-100 bg-white text-surface-600 hover:border-emerald-300'}`}
                  onClick={() => setFertilizerKindFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-emerald-600 bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:border-surface-200 disabled:bg-surface-200 disabled:text-surface-500"
                onClick={exportFertilizerExcel}
                disabled={!fertilizerWorkbook.rows.length && !fertilizerTableRows.length}
              >
                <FileSpreadsheet size={14} /> Export Excel
              </button>
            </div>
          </div>

          <div className={`mb-4 grid grid-cols-1 ${densityGap(density)} xl:grid-cols-3`}>
            <div className="rounded-[20px] border border-emerald-200 bg-white/90 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700">Workbook View</div>
              <div className="mt-2 text-lg font-semibold text-surface-900">{fertilizerWorkbook.rows.length.toLocaleString('th-TH')} {viewMode === 'camp' ? 'ไร่ในตาราง' : 'แปลงในตาราง'}</div>
              <div className="mt-1 text-xs text-surface-500">แสดงแยกตามปีการผลิตที่เลือก, ประเภทอ้อย, รายการปุ๋ย, รวมกิโลกรัม และ warning ของแต่ละ{viewMode === 'camp' ? 'ไร่' : 'แปลง'}</div>
            </div>
            <div className="rounded-[20px] border border-emerald-200 bg-white/90 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700">Year Groups</div>
              <div className="mt-2 text-lg font-semibold text-surface-900">{fertilizerWorkbook.years.length.toLocaleString('th-TH')} ปีการผลิตที่พบข้อมูล</div>
              <div className="mt-1 text-xs text-surface-500">คอลัมน์จะถูกจัดเป็นกลุ่มปีการผลิตตามปีที่เลือกจากตัวกรองร่วม</div>
            </div>
            <div className="rounded-[20px] border border-amber-200 bg-[linear-gradient(180deg,rgba(255,252,245,0.98),rgba(255,247,229,0.98))] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700">Display Note</div>
              <div className="mt-2 text-sm font-semibold text-surface-900">ค่าที่แสดงใน workbook เป็นกิโลกรัมทั้งหมด</div>
              <div className="mt-1 text-xs text-surface-600">ถ้าหน่วยต้นทางแปลงไม่ได้ ระบบจะขึ้น warning และไม่เอาไปรวมเพื่อกันผลรวมผิด</div>
            </div>
          </div>

          <FertilizerWorkbookTable years={fertilizerWorkbook.years} rows={fertilizerWorkbook.rows} mode={viewMode} />

          <div className={`mt-4 grid grid-cols-1 ${densityGap(density)} xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]`}>
            <div className="rounded-[20px] border border-emerald-200 bg-white/92 p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-surface-800">ปริมาณตามรายการปุ๋ย</h3>
              <UsageBars rows={fertilizerChartRows} unit="kg" emptyLabel="ยังไม่มีข้อมูลปุ๋ยในตัวกรองนี้" />
            </div>
            <div className="min-w-0 rounded-[20px] border border-emerald-200 bg-white/92 p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-surface-800">ตารางสรุปปุ๋ยตาม{viewMode === 'camp' ? 'ไร่' : 'แปลง'}</h3>
              <DataTable
                data={fertilizerTableRows}
                columns={usageColumns}
                isLoading={isLoading}
                rowKey={(row) => row.key}
                defaultPageSize={DEFAULT_USAGE_TABLE_PAGE_SIZE}
                searchPlaceholder="ค้นหาไร่ แปลง ปีการผลิต หรือรายการปุ๋ย..."
                emptyMessage="ยังไม่มีข้อมูลปุ๋ยในตัวกรองนี้"
              />
            </div>
          </div>
        </section>

        <section className={`rounded-[26px] border border-sky-200 bg-[linear-gradient(180deg,rgba(246,252,255,0.98),rgba(234,246,253,0.98))] shadow-sm ${densityPadding(density)}`}>
          <div className="mb-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-[11px] font-semibold text-sky-800">
              <Droplets size={14} className="text-sky-700" /> Section 2
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-surface-900"><Droplets size={16} className="text-sky-700" /> ส่วนที่ 2: น้ำมัน</div>
            <p className="mt-1 text-xs text-surface-500">รวมเป็น L จากรายการน้ำมันหรือเชื้อเพลิง โดยแยกบล็อกสีฟ้าออกจากส่วนปุ๋ยเพื่อให้สแกนหน้าจอง่ายขึ้น</p>
          </div>

          <div className={`grid grid-cols-1 ${densityGap(density)} xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]`}>
            <div className="rounded-[20px] border border-sky-200 bg-white/92 p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-surface-800">ปริมาณตามชนิดน้ำมัน</h3>
              <UsageBars rows={fuelChartRows} unit="L" emptyLabel="ยังไม่มีข้อมูลน้ำมันในตัวกรองนี้" />
            </div>
            <div className="min-w-0 rounded-[20px] border border-sky-200 bg-white/92 p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-surface-800">ตารางสรุปน้ำมันตาม{viewMode === 'camp' ? 'ไร่' : 'แปลง'}</h3>
              <DataTable
                data={fuelTableRows}
                columns={usageColumns}
                isLoading={isLoading}
                rowKey={(row) => row.key}
                defaultPageSize={DEFAULT_USAGE_TABLE_PAGE_SIZE}
                searchPlaceholder="ค้นหาไร่ แปลง ปีการผลิต หรือรายการน้ำมัน..."
                emptyMessage="ยังไม่มีข้อมูลน้ำมันในตัวกรองนี้"
              />
            </div>
          </div>
        </section>

        <section className={`rounded-[26px] border border-violet-200 bg-[linear-gradient(180deg,rgba(251,249,255,0.98),rgba(243,239,255,0.98))] shadow-sm ${densityPadding(density)}`}>
          <div className="mb-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-violet-800">
              <GitCompare size={13} className="text-violet-700" /> Comparison Workspace
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-surface-900">
              <GitCompare size={15} className="text-violet-700" /> เปรียบเทียบไร่ / แปลง
            </div>
            <p className="mt-1 text-xs text-surface-500">เพิ่มได้สูงสุด 10 กล่อง และระบบจะจัดหลายแถวให้อัตโนมัติเพื่อให้ชื่อไร่หรือแปลงยังอ่านได้</p>
          </div>

          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="w-full max-w-xs">
              <label className="label">เปรียบเทียบแบบ</label>
              <select
                className="select"
                value={comparisonType}
                onChange={(event) => {
                  const nextType = event.target.value as ViewMode
                  setComparisonType(nextType)
                  setComparisonIds(['', ''])
                }}
              >
                <option value="camp">รายไร่</option>
                <option value="land">รายแปลง</option>
              </select>
            </div>
            <div className="flex flex-col items-stretch gap-2 lg:items-end">
              <button type="button" className="btn-secondary w-full justify-center lg:w-auto" disabled={comparisonIds.length >= MAX_COMPARISON_TARGETS} onClick={addComparisonTarget}>
                <Plus size={14} /> เพิ่มช่องเปรียบเทียบ
              </button>
              <div className="text-[11px] text-surface-500">
                ใช้งานอยู่ {comparisonIds.length} / {MAX_COMPARISON_TARGETS} กล่อง
              </div>
            </div>
          </div>

          <div className={`grid grid-cols-1 ${densityGap(density)} md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4`}>
            {comparisonIds.map((targetId, index) => {
              const target = comparisonOptions.find((option) => option.id === targetId)
              const fertilizerDiff = target && comparisonBase ? target.fertilizerKg - comparisonBase.fertilizerKg : 0
              const fuelDiff = target && comparisonBase ? target.fuelLiter - comparisonBase.fuelLiter : 0
              return (
                <div key={`${index}:${targetId}`} className="min-w-0 rounded-[20px] border border-violet-200 bg-white/88 p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <select className="select min-w-0 flex-1 text-sm" value={targetId} onChange={(event) => setComparisonTarget(index, event.target.value)}>
                      <option value="">เลือก{comparisonType === 'camp' ? 'ไร่' : 'แปลง'}</option>
                      {comparisonOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                    {comparisonIds.length > 2 && (
                      <button type="button" className="btn-icon btn-ghost shrink-0" onClick={() => removeComparisonTarget(index)} aria-label="ลบช่องเปรียบเทียบ">
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {target ? (
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs text-surface-500">พื้นที่ / Record</div>
                        <div className="mt-1 break-words font-mono text-base font-bold leading-6 text-surface-900">{formatNumber(target.areaRai, 2)} ไร่ · {target.recordCount.toLocaleString('th-TH')}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-emerald-100 bg-[linear-gradient(180deg,rgba(248,255,250,0.98),rgba(239,251,244,0.98))] p-3">
                          <div className="text-[11px] text-surface-500">ปุ๋ยรวม</div>
                          <div className="break-words font-mono text-sm font-bold text-emerald-700">{formatAmount(target.fertilizerKg, 'kg', 1)}</div>
                          <div className={`mt-1 break-words text-[11px] leading-5 ${fertilizerDiff <= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                            {index === 0 ? 'ฐานเปรียบเทียบ' : `${fertilizerDiff >= 0 ? '+' : ''}${formatAmount(fertilizerDiff, 'kg', 1)}`}
                          </div>
                        </div>
                        <div className="rounded-xl border border-sky-100 bg-[linear-gradient(180deg,rgba(248,252,255,0.98),rgba(239,247,254,0.98))] p-3">
                          <div className="text-[11px] text-surface-500">น้ำมันรวม</div>
                          <div className="break-words font-mono text-sm font-bold text-sky-700">{formatAmount(target.fuelLiter, 'L', 2)}</div>
                          <div className={`mt-1 break-words text-[11px] leading-5 ${fuelDiff <= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                            {index === 0 ? 'ฐานเปรียบเทียบ' : `${fuelDiff >= 0 ? '+' : ''}${formatAmount(fuelDiff, 'L', 2)}`}
                          </div>
                        </div>
                      </div>
                      <div className="rounded-xl border border-violet-100 bg-[linear-gradient(180deg,rgba(251,250,255,0.98),rgba(246,243,255,0.98))] p-3 text-xs leading-6 text-surface-600">
                        <div className="break-words"><span className="font-medium text-surface-800">Top ปุ๋ย:</span> {target.topFertilizer}</div>
                        <div className="mt-1 break-words"><span className="font-medium text-surface-800">Top น้ำมัน:</span> {target.topFuel}</div>
                        <div className="mt-1 break-words"><span className="font-medium text-surface-800">อื่น ๆ:</span> {target.otherRecordCount.toLocaleString('th-TH')} record</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-surface-200 bg-white text-sm text-surface-500">
                      ยังไม่ได้เลือกข้อมูลเปรียบเทียบ
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <section className={`rounded-[26px] border border-amber-200 bg-[linear-gradient(180deg,rgba(255,252,247,0.98),rgba(255,246,232,0.98))] shadow-sm ${densityPadding(density)}`}>
          <div className="mb-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/85 px-3 py-1 text-[11px] font-semibold text-amber-800">
              <FlaskConical size={14} className="text-amber-700" /> Other Inputs
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-surface-900">
              <FlaskConical size={16} className="text-amber-700" /> ปัจจัยอื่น ๆ
            </div>
            <p className="mt-1 text-xs text-surface-500">แสดงเฉพาะ 5 แถวต่อหน้าเป็นค่าเริ่มต้น เพื่อให้หน้าอ่านง่ายและไม่แน่นเกินไป</p>
          </div>
          <DataTable
            data={visibleOtherRows}
            columns={otherColumns}
            isLoading={isLoading}
            rowKey={(row) => row.id}
            defaultPageSize={DEFAULT_USAGE_TABLE_PAGE_SIZE}
            searchPlaceholder="ค้นหาปัจจัยอื่น ๆ..."
            emptyMessage="ยังไม่มีข้อมูลปัจจัยอื่น ๆ ในตัวกรองนี้"
          />
        </section>
      </div>
    </div>
  )
}
