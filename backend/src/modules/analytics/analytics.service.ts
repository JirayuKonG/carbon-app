import { Prisma } from '@prisma/client'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import {
  resolveProductionYearLabel,
  resolveProductionYearSortYear,
} from '../activities/production-year.util'

type FilterLevel = 'all' | 'region' | 'province' | 'district' | 'subdistrict' | 'field'

type EmissionRow = {
  queue_id: number | null
  year: number | null
  production_year_label: string | null
  production_year_sort_key: number | null
  co2e: number | null
  credit_co2e: number | null
  actual_soc: number | null
  cal_status_id: number | null
  queue_info: string | null
  input_amount: number | null
  area_work: number | null
  process: string | null
  activity: string | null
  cane_type_name: string | null
  land_id: number | null
  land_code: string | null
  land_name: string | null
  land_area: number | null
  land_lat: string | null
  land_lng: string | null
  camp_id: number | null
  camp_name: string | null
  camp_lat: string | null
  camp_lng: string | null
  farmer_id: number | null
  farmer_name: string | null
  phone: string | null
  region_id: number | null
  region_name: string | null
  province_id: number | null
  province_name: string | null
  district_id: number | null
  district_name: string | null
  subdistrict_id: number | null
  subdistrict_name: string | null
  subdistrict_lat: string | null
  subdistrict_lng: string | null
}

type YearMeta = {
  years: string[]
  currentYear?: string
  baselineYears: string[]
}

type ProcessActivityBreakdown = {
  year: string
  process: string
  totalEmission: number
  activities: { name: string; emission: number }[]
}

type ProcessInputComparison = {
  process: string
  baselineFertilizerKg: number
  currentFertilizerKg: number
  baselineFuelLiter: number
  currentFuelLiter: number
}

type CalculationBreakdown = Record<string, unknown>

type SpatialNode = {
  calStatusId?: number
  actualCredit?: number
  actualSoc?: number
  id: string
  parentId?: string
  level: 'country' | 'region' | 'province' | 'district' | 'subdistrict' | 'field'
  name: string
  lat: number
  lng: number
  zoom: number
  fields: number
  farmers: number
  areaRai: number
  baselineEmission: number
  currentEmission: number
  processBreakdown: { name: string; emission: number }[]
  childrenIds: string[]
  fieldCode?: string
  fieldName?: string
  farmerName?: string
  phone?: string
  province?: string
  district?: string
  subdistrict?: string
  soilType?: string
  irrigationType?: string
  chanots?: { chanotNo: string; areaRai: number }[]
  calculationBreakdowns?: CalculationBreakdown[]
}

type ReportFilter = {
  level?: FilterLevel
  id?: string
  year?: string | number
}

type CalculationSummaryMode = 'footprint' | 'credit'
type CalculationSummaryScope = 'all' | 'camp_group' | 'camp' | 'land'
type CalculationSummaryGroupBy = 'year' | 'camp_group' | 'camp' | 'land'
type CalculationSummaryStatus = 'api_real' | 'api_partial' | 'missing'

type CalculationSummaryQuery = {
  mode?: string
  years?: string
  yearFrom?: string
  yearTo?: string
  scope?: string
  campGroupId?: string | number
  campId?: string | number
  landId?: string | number
  groupBy?: string
  baselineYears?: string
  projectYear?: string
}

type CalculationSummaryInsight = {
  type: 'good' | 'warning' | 'info'
  title: string
  detail: string
  value?: string
}

type CalculationSummaryAuditItem = {
  queueId?: number | null
  activityDetailId?: number | null
  productionYearLabel?: string | null
  campLabel?: string | null
  landLabel?: string | null
  resourceName?: string | null
  formulaMode?: string | null
  preparedAmount?: number | null
  preparedUnitLabel?: string | null
  efId?: number | null
  gwpId?: number | null
  resultValue?: number | null
  resultUnitLabel?: string | null
  resultTco2e?: number | null
  statusName?: string | null
  errorMessage?: string | null
  calculationBreakdown?: Record<string, unknown> | null
}

type CalculationSummaryRow = {
  id: string
  groupType: CalculationSummaryGroupBy
  groupLabel: string
  productionYearLabel?: string
  campGroupId?: number | null
  campId?: number | null
  landId?: number | null
  areaRai: number
  grossEmissionTco2e: number
  socRemovalTco2e: number
  netEmissionTco2e: number
  creditTco2e?: number
  intensityTco2ePerRai?: number | null
  datasourceStatus: CalculationSummaryStatus
  auditItems: CalculationSummaryAuditItem[]
}

type NormalizedCalculationQueueRow = {
  queueId: number
  activityDetailId: number | null
  productionYearLabel: string
  productionYearSortKey: number | null
  campGroupId: number | null
  campGroupLabel: string
  campId: number | null
  campLabel: string
  landId: number | null
  landLabel: string
  areaRai: number
  grossEmissionTco2e: number | null
  creditResultTco2e: number | null
  sourceResultValue: number | null
  sourceCreditResultValue: number | null
  resultUnitLabel: string
  creditResultUnitLabel: string
  statusName: string | null
  errorMessage: string | null
  resourceName: string
  formulaMode: string | null
  preparedAmount: number | null
  preparedUnitLabel: string | null
  calculationBreakdown: Record<string, unknown> | null
  auditItem: CalculationSummaryAuditItem
}

const TRANSPORT_RE = /(ขนส่ง|transport|truck|รถ|โรงงาน)/i

const FERTILIZER_RE = /(fertilizer|chemical|input|n2o|ไนโตรเจน|ปุ๋ย|สารเคมี)/i
const FUEL_RE = /(fuel|diesel|machine|เครื่อง|รถ|น้ำมัน)/i

function n(value: unknown): number {
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  // Prisma Decimal type: object with toString()
  if (value !== null && typeof value === 'object' && typeof (value as { toString?: unknown }).toString === 'function') {
    const parsed = Number((value as { toString(): string }).toString())
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function round(value: number, digits = 2): number {
  return +value.toFixed(digits)
}

function keyPart(value: number | null | undefined): string {
  return value == null ? 'unknown' : String(value)
}

function isTransport(row: Pick<EmissionRow, 'process' | 'activity'>): boolean {
  return TRANSPORT_RE.test(`${row.process ?? ''} ${row.activity ?? ''}`)
}

function labelOr(value: string | null | undefined, fallback: string): string {
  const text = value?.trim()
  return text ? text : fallback
}

function addToMap(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) ?? 0) + value)
}

function mapToValues(map: Map<string, number>) {
  return Array.from(map.entries())
    .map(([name, emission]) => ({ name, emission: round(emission) }))
    .sort((a, b) => b.emission - a.emission)
}

function stableIndex(key: string, modulo: number) {
  let hash = 0
  for (let index = 0; index < key.length; index += 1) {
    hash = ((hash * 33) + key.charCodeAt(index)) % 1000003
  }
  return hash % modulo
}

function emissionRowYearLabel(row: Pick<EmissionRow, 'production_year_label' | 'year'>) {
  return resolveProductionYearLabel(row.production_year_label, row.year != null ? new Date(row.year, 0, 1) : null)
}

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  private readonly calculatedStatusCacheTtlMs = 60_000
  private readonly emissionRowsCacheTtlMs = 5_000
  private calculatedStatusIdsCache: { expiresAt: number; ids: number[] } | null = null
  private calculatedStatusIdsRequest: Promise<number[]> | null = null
  private emissionRowsCache: { expiresAt: number; rows: EmissionRow[] } | null = null
  private emissionRowsRequest: Promise<EmissionRow[]> | null = null

  private normalizeText(value: string | null | undefined) {
    return (value ?? '').trim().toLowerCase()
  }

  private farmGroupForRow(row: Pick<EmissionRow, 'region_id' | 'region_name' | 'province_name' | 'district_name'>): 'dan-chang' | 'isan' | undefined {
    const regionName = this.normalizeText(row.region_name)
    const provinceName = this.normalizeText(row.province_name)
    const districtName = this.normalizeText(row.district_name)
    if (
      row.region_id === 300
      || provinceName.includes('สุพรรณ')
      || districtName.includes('ด่านช้าง')
    ) {
      return 'dan-chang'
    }
    if (
      row.region_id === 600
      || regionName.includes('อีสาน')
      || regionName.includes('ตะวันออกเฉียงเหนือ')
    ) {
      return 'isan'
    }
    return undefined
  }

  private farmGroupLabel(group: 'dan-chang' | 'isan') {
    return group === 'dan-chang' ? 'ไร่ด่านช้าง' : 'ไร่อีสาน'
  }

  private regionNodeId(row: Pick<EmissionRow, 'region_id' | 'region_name' | 'province_name' | 'district_name'>) {
    return this.farmGroupForRow(row) ?? `region-${keyPart(row.region_id)}`
  }

  private regionNodeName(row: Pick<EmissionRow, 'region_id' | 'region_name' | 'province_name' | 'district_name'>) {
    const group = this.farmGroupForRow(row)
    return group ? this.farmGroupLabel(group) : labelOr(row.region_name, 'ไม่ระบุภาค')
  }

  private stableCampId(campName: string | null | undefined, row: Pick<EmissionRow, 'region_id' | 'region_name' | 'province_name' | 'district_name'>) {
    const group = this.farmGroupForRow(row)
    if (!group) return undefined
    const normalizedCampName = labelOr(campName, 'Unassigned camp')
    return 100000 + stableIndex(`${group}:${normalizedCampName}`, 900000)
  }

  private presentationCampId(row: Pick<EmissionRow, 'camp_id' | 'camp_name' | 'region_id' | 'region_name' | 'province_name' | 'district_name'>) {
    return this.stableCampId(row.camp_name, row) ?? row.camp_id ?? -1
  }

  private parseCalculationBreakdown(value: string | null | undefined): CalculationBreakdown | undefined {
    if (!value) return undefined
    try {
      const parsed: unknown = JSON.parse(value)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
      const record = parsed as Record<string, unknown>
      const calculation = record.calculation
      if (calculation && typeof calculation === 'object' && !Array.isArray(calculation)) return calculation as CalculationBreakdown
      const result = record.result
      if (result && typeof result === 'object' && !Array.isArray(result)) return result as CalculationBreakdown
      if (
        record.formulaMode
        || record.calculationMethod
        || record.upstreamKgco2e != null
        || record.usePhaseKgco2e != null
        || record.resultValue != null
      ) {
        return record
      }
      return undefined
    } catch {
      return undefined
    }
  }

  private calculationBreakdowns(rows: EmissionRow[], limit = 12): CalculationBreakdown[] {
    const seen = new Set<string>()
    const result: CalculationBreakdown[] = []
    rows.forEach((row) => {
      const breakdown = this.parseCalculationBreakdown(row.queue_info)
      if (!breakdown) return
      const key = JSON.stringify(breakdown)
      if (seen.has(key)) return
      seen.add(key)
      result.push(breakdown)
    })
    return result.slice(0, limit)
  }

  private parseQueueInfo(value: string | null | undefined): Record<string, unknown> {
    if (!value) return {}
    try {
      const parsed: unknown = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
    } catch {
      return {}
    }
  }

  private csvValues(value: string | undefined): string[] {
    return String(value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  private optionalInt(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') return undefined
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  private calculationSummaryMode(value?: string): CalculationSummaryMode {
    return value === 'credit' ? 'credit' : 'footprint'
  }

  private calculationSummaryScope(value?: string): CalculationSummaryScope {
    return value === 'camp_group' || value === 'camp' || value === 'land' ? value : 'all'
  }

  private calculationSummaryGroupBy(value: string | undefined, mode: CalculationSummaryMode, scope: CalculationSummaryScope): CalculationSummaryGroupBy {
    if (value === 'year' || value === 'camp_group' || value === 'camp' || value === 'land') return value
    if (scope === 'camp_group' || scope === 'camp' || scope === 'land') return scope
    return mode === 'credit' ? 'land' : 'year'
  }

  private unitLabel(unit?: { unit_name?: string | null; unit_initial?: string | null } | null) {
    return unit?.unit_initial?.trim() || unit?.unit_name?.trim() || ''
  }

  private resultToTco2e(value: unknown, unit?: { unit_name?: string | null; unit_initial?: string | null } | null): number | null {
    if (value === undefined || value === null || value === '') return null
    const amount = n(value)
    const unitText = this.unitLabel(unit).toLowerCase()
    if (unitText.includes('kg') || unitText.includes('กิโล')) return amount / 1000
    if (unitText.includes('gco') || unitText === 'g' || unitText.includes('กรัม')) return amount / 1000000
    return amount
  }

  private landAreaRai(land: any): number {
    return n(land?.land_size ?? land?.area_size)
  }

  private landLabel(land: any, fallback: string) {
    const code = String(land?.land_code ?? '').trim()
    const name = String(land?.name ?? '').trim()
    if (code && name) return `${code} - ${name}`
    return code || name || fallback
  }

  private resourceName(detail: any): string {
    return detail?.activities_fertilizers?.act_fertilizer_name
      ?? detail?.activities_equipments?.act_equipment_name
      ?? detail?.activities_chemiscals?.act_chemiscal_name
      ?? detail?.activities_resourceOther?.act_resourceOther_name
      ?? detail?.resource_used_type?.resc_used_type_name
      ?? detail?.activities_header_detail_type?.act_header_detail_type_name_th
      ?? 'ไม่ระบุปัจจัย'
  }

  private preparedUnitLabel(info: Record<string, unknown>, detail: any): string | null {
    const named = [info.preparedUnitInitial, info.preparedUnitName]
      .map((value) => typeof value === 'string' ? value.trim() : '')
      .find(Boolean)
    if (named) return named
    const preparedUnitId = this.optionalInt(info.preparedUnitId)
    if (preparedUnitId) return `unit #${preparedUnitId}`
    const detailUnit = this.unitLabel(detail?.units)
    return detailUnit || null
  }

  private calculationNumber(record: Record<string, unknown> | null | undefined, keys: string[]): number | null {
    if (!record) return null
    for (const key of keys) {
      const value = record[key]
      if (value !== undefined && value !== null && value !== '') {
        const parsed = n(value)
        if (Number.isFinite(parsed)) return parsed
      }
    }
    return null
  }

  private yearOptionMap(rows: NormalizedCalculationQueueRow[]) {
    const yearMap = new Map<string, number | null>()
    rows.forEach((row) => {
      const existing = yearMap.get(row.productionYearLabel)
      const sortKey = row.productionYearSortKey
      if (existing === undefined || (sortKey != null && (existing == null || sortKey < existing))) {
        yearMap.set(row.productionYearLabel, sortKey)
      }
    })
    return yearMap
  }

  private sortedYearOptions(rows: NormalizedCalculationQueueRow[]) {
    return Array.from(this.yearOptionMap(rows).entries())
      .map(([label, sortYear]) => ({ label, value: label, sortYear }))
      .sort((left, right) => {
        const leftSort = left.sortYear ?? Number.MAX_SAFE_INTEGER
        const rightSort = right.sortYear ?? Number.MAX_SAFE_INTEGER
        if (leftSort !== rightSort) return leftSort - rightSort
        return left.label.localeCompare(right.label, ['th', 'en'], { numeric: true })
      })
  }

  private normalizeCalculationQueueRow(queue: any): NormalizedCalculationQueueRow {
    const detail = queue?.log_activities_detail
    const header = detail?.activities_header
    const land = queue?.lands ?? header?.lands
    const camp = land?.lands_camps ?? queue?.lands_camps
    const campGroup = camp?.lands_camps_groups
    const fallbackDate = header?.activities_header_startDate ?? header?.activities_header_create_at ?? queue?.carbon_process_queue_dateWork ?? null
    const fallbackDateObject = fallbackDate ? new Date(fallbackDate) : null
    const productionYearLabel = resolveProductionYearLabel(detail?.activities_productYear?.act_productYear_name, fallbackDateObject) ?? 'ไม่ระบุปีการผลิต'
    const productionYearSortKey = resolveProductionYearSortYear(detail?.activities_productYear?.act_productYear_name, fallbackDateObject)
    const info = this.parseQueueInfo(queue?.carbon_process_queue_info)
    const calculation = this.parseCalculationBreakdown(queue?.carbon_process_queue_info) ?? null
    const grossEmissionTco2e = this.resultToTco2e(queue?.carbon_process_queue_resultValue, queue?.units)
    const creditResultTco2e = this.resultToTco2e(queue?.carbon_process_queue_resultValueCreditCalc, queue?.units_creditResultValue)
    const formulaMode = typeof calculation?.formulaMode === 'string'
      ? calculation.formulaMode
      : typeof calculation?.calculationMethod === 'string'
        ? calculation.calculationMethod
        : null
    const preparedAmount = this.calculationNumber(info, ['preparedVolumeAll', 'preparedAmount'])
      ?? this.calculationNumber(calculation, ['fertilizerKg', 'amount'])
    const preparedUnitLabel = this.preparedUnitLabel(info, detail)
    const resultUnitLabel = this.unitLabel(queue?.units)
    const creditResultUnitLabel = this.unitLabel(queue?.units_creditResultValue)
    const landId = land?.land_id ?? queue?.land_id ?? header?.land_id ?? null
    const campId = camp?.land_camp_id ?? queue?.land_camp_id ?? null
    const campGroupId = campGroup?.land_camp_group_id ?? camp?.land_camp_group_id ?? null
    const row: NormalizedCalculationQueueRow = {
      queueId: queue?.carbon_process_queue_id,
      activityDetailId: detail?.log_act_detail_id ?? queue?.log_act_detail_id ?? null,
      productionYearLabel,
      productionYearSortKey,
      campGroupId,
      campGroupLabel: campGroup?.land_camp_group_name ?? (campGroupId ? `กลุ่มไร่ #${campGroupId}` : 'ไม่ระบุกลุ่มไร่'),
      campId,
      campLabel: camp?.land_camp_name ?? (campId ? `ไร่ / แคมป์ #${campId}` : 'ไม่ระบุไร่ / แคมป์'),
      landId,
      landLabel: this.landLabel(land, landId ? `แปลง #${landId}` : 'ไม่ระบุแปลง'),
      areaRai: this.landAreaRai(land),
      grossEmissionTco2e,
      creditResultTco2e,
      sourceResultValue: queue?.carbon_process_queue_resultValue == null ? null : n(queue.carbon_process_queue_resultValue),
      sourceCreditResultValue: queue?.carbon_process_queue_resultValueCreditCalc == null ? null : n(queue.carbon_process_queue_resultValueCreditCalc),
      resultUnitLabel,
      creditResultUnitLabel,
      statusName: queue?.log_act_detail_calStatus?.log_act_detail_calStatus_name
        ?? detail?.log_act_detail_calStatus?.log_act_detail_calStatus_name
        ?? null,
      errorMessage: queue?.carbon_process_queue_error_message ?? null,
      resourceName: this.resourceName(detail),
      formulaMode,
      preparedAmount,
      preparedUnitLabel,
      calculationBreakdown: calculation,
      auditItem: {
        queueId: queue?.carbon_process_queue_id ?? null,
        activityDetailId: detail?.log_act_detail_id ?? queue?.log_act_detail_id ?? null,
        productionYearLabel,
        campLabel: camp?.land_camp_name ?? null,
        landLabel: this.landLabel(land, landId ? `แปลง #${landId}` : ''),
        resourceName: this.resourceName(detail),
        formulaMode,
        preparedAmount,
        preparedUnitLabel,
        efId: this.calculationNumber(calculation, ['efId', 'fertilizerUreaEfId', 'fertilizerDapEfId', 'fertilizerKclEfId']),
        gwpId: this.calculationNumber(calculation, ['fertilizerGwpId', 'gwpId']),
        resultValue: queue?.carbon_process_queue_resultValue == null ? null : n(queue.carbon_process_queue_resultValue),
        resultUnitLabel,
        resultTco2e: grossEmissionTco2e,
        statusName: queue?.log_act_detail_calStatus?.log_act_detail_calStatus_name
          ?? detail?.log_act_detail_calStatus?.log_act_detail_calStatus_name
          ?? null,
        errorMessage: queue?.carbon_process_queue_error_message ?? null,
        calculationBreakdown: calculation,
      },
    }
    return row
  }

  private async getCalculationSummaryQueueRows(): Promise<NormalizedCalculationQueueRow[]> {
    const queues = await this.prisma.carbon_process_queue.findMany({
      include: {
        log_act_detail_calStatus: { select: { log_act_detail_calStatus_name: true } },
        units: { select: { unit_name: true, unit_initial: true } },
        units_creditResultValue: { select: { unit_name: true, unit_initial: true } },
        lands: {
          select: {
            land_id: true,
            land_code: true,
            name: true,
            land_size: true,
            area_size: true,
            lands_camps: {
              select: {
                land_camp_id: true,
                land_camp_name: true,
                land_camp_group_id: true,
                lands_camps_groups: {
                  select: {
                    land_camp_group_id: true,
                    land_camp_group_name: true,
                  },
                },
              },
            },
          },
        },
        lands_camps: {
          select: {
            land_camp_id: true,
            land_camp_name: true,
            land_camp_group_id: true,
            lands_camps_groups: {
              select: {
                land_camp_group_id: true,
                land_camp_group_name: true,
              },
            },
          },
        },
        log_activities_detail: {
          include: {
            activities_header: {
              select: {
                activities_header_id: true,
                activities_header_startDate: true,
                activities_header_create_at: true,
                land_id: true,
                lands: {
                  select: {
                    land_id: true,
                    land_code: true,
                    name: true,
                    land_size: true,
                    area_size: true,
                    lands_camps: {
                      select: {
                        land_camp_id: true,
                        land_camp_name: true,
                        land_camp_group_id: true,
                        lands_camps_groups: {
                          select: {
                            land_camp_group_id: true,
                            land_camp_group_name: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            activities_header_type: { select: { act_header_type_name_th: true, act_header_type_name_en: true } },
            activities_header_detail_type: { select: { act_header_detail_type_name_th: true } },
            activities_fertilizers: { select: { act_fertilizer_name: true } },
            activities_equipments: { select: { act_equipment_name: true } },
            activities_chemiscals: { select: { act_chemiscal_name: true } },
            activities_resourceOther: { select: { act_resourceOther_name: true } },
            activities_productYear: { select: { act_productYear_name: true } },
            resource_used_type: { select: { resc_used_type_name: true } },
            log_act_detail_calStatus: { select: { log_act_detail_calStatus_name: true } },
            units: { select: { unit_name: true, unit_initial: true } },
          },
        },
      },
      orderBy: [
        { carbon_process_queue_updated_at: 'desc' },
        { carbon_process_queue_id: 'desc' },
      ],
    })

    return queues.map((queue) => this.normalizeCalculationQueueRow(queue))
  }

  private async getCalculationSummarySocRows() {
    const rows = await this.prisma.carbon_soc.findMany({
      include: {
        lands: {
          select: {
            land_id: true,
            land_code: true,
            name: true,
            land_size: true,
            area_size: true,
            lands_camps: {
              select: {
                land_camp_id: true,
                land_camp_name: true,
                land_camp_group_id: true,
                lands_camps_groups: {
                  select: {
                    land_camp_group_id: true,
                    land_camp_group_name: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    return rows.map((row) => {
      const land = row.lands
      const camp = land?.lands_camps
      const group = camp?.lands_camps_groups
      return {
        landId: row.land_id ?? null,
        campId: camp?.land_camp_id ?? null,
        campGroupId: group?.land_camp_group_id ?? camp?.land_camp_group_id ?? null,
        socTco2e: n(row.carbon_soc_socIT),
      }
    })
  }

  private applyCalculationSummaryFilters(rows: NormalizedCalculationQueueRow[], query: CalculationSummaryQuery): NormalizedCalculationQueueRow[] {
    const selectedYears = new Set(this.csvValues(query.years))
    const yearOptions = this.yearOptionMap(rows)
    const fromSort = query.yearFrom ? yearOptions.get(query.yearFrom) ?? resolveProductionYearSortYear(query.yearFrom, null) : null
    const toSort = query.yearTo ? yearOptions.get(query.yearTo) ?? resolveProductionYearSortYear(query.yearTo, null) : null
    const scope = this.calculationSummaryScope(query.scope)
    const campGroupId = this.optionalInt(query.campGroupId)
    const campId = this.optionalInt(query.campId)
    const landId = this.optionalInt(query.landId)

    return rows.filter((row) => {
      if (selectedYears.size && !selectedYears.has(row.productionYearLabel)) return false
      if (fromSort != null && row.productionYearSortKey != null && row.productionYearSortKey < fromSort) return false
      if (toSort != null && row.productionYearSortKey != null && row.productionYearSortKey > toSort) return false
      if (scope === 'camp_group' && campGroupId != null && row.campGroupId !== campGroupId) return false
      if (scope === 'camp' && campId != null && row.campId !== campId) return false
      if (scope === 'land' && landId != null && row.landId !== landId) return false
      return true
    })
  }

  private uniqueCalculationArea(rows: NormalizedCalculationQueueRow[]) {
    const byLand = new Map<number, number>()
    let unassignedArea = 0
    rows.forEach((row) => {
      if (row.landId != null) {
        byLand.set(row.landId, Math.max(byLand.get(row.landId) ?? 0, row.areaRai))
      } else {
        unassignedArea += row.areaRai
      }
    })
    return Array.from(byLand.values()).reduce((sum, area) => sum + area, 0) + unassignedArea
  }

  private socForRows(rows: NormalizedCalculationQueueRow[], socRows: Array<{ landId: number | null; campId: number | null; campGroupId: number | null; socTco2e: number }>) {
    const landIds = new Set(rows.map((row) => row.landId).filter((value): value is number => value != null))
    return socRows
      .filter((row) => row.landId != null && landIds.has(row.landId))
      .reduce((sum, row) => sum + row.socTco2e, 0)
  }

  private groupCalculationRows(rows: NormalizedCalculationQueueRow[], groupBy: CalculationSummaryGroupBy) {
    const groups = new Map<string, NormalizedCalculationQueueRow[]>()
    rows.forEach((row) => {
      const key = groupBy === 'year'
        ? row.productionYearLabel
        : groupBy === 'camp_group'
          ? `camp_group:${row.campGroupId ?? 'unknown'}`
          : groupBy === 'camp'
            ? `camp:${row.campId ?? 'unknown'}`
            : `land:${row.landId ?? 'unknown'}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(row)
    })
    return groups
  }

  private groupLabelFromRows(groupBy: CalculationSummaryGroupBy, rows: NormalizedCalculationQueueRow[]) {
    const first = rows[0]
    if (!first) return 'ไม่พบข้อมูล'
    if (groupBy === 'year') return first.productionYearLabel
    if (groupBy === 'camp_group') return first.campGroupLabel
    if (groupBy === 'camp') return first.campLabel
    return first.landLabel
  }

  private addSummaryValue(map: Map<string, number>, key: string | null | undefined, value: number | null | undefined) {
    const label = key?.trim() || 'ไม่ระบุ'
    map.set(label, (map.get(label) ?? 0) + (value ?? 0))
  }

  private mapSummaryValues(map: Map<string, number>) {
    return Array.from(map.entries())
      .map(([name, valueTco2e]) => ({ name, valueTco2e: round(valueTco2e, 4) }))
      .sort((left, right) => right.valueTco2e - left.valueTco2e)
  }

  private buildCalculationFilters(rows: NormalizedCalculationQueueRow[]) {
    const campGroups = new Map<number, string>()
    const camps = new Map<number, { label: string; groupId?: number | null }>()
    const lands = new Map<number, { label: string; campId?: number | null; groupId?: number | null }>()

    rows.forEach((row) => {
      if (row.campGroupId != null) campGroups.set(row.campGroupId, row.campGroupLabel)
      if (row.campId != null) camps.set(row.campId, { label: row.campLabel, groupId: row.campGroupId })
      if (row.landId != null) lands.set(row.landId, { label: row.landLabel, campId: row.campId, groupId: row.campGroupId })
    })

    const sortByLabel = <T extends { label: string }>(items: T[]) => items.sort((left, right) => (
      left.label.localeCompare(right.label, ['th', 'en'], { numeric: true, sensitivity: 'base' })
    ))

    return {
      yearOptions: this.sortedYearOptions(rows),
      campGroups: sortByLabel(Array.from(campGroups.entries()).map(([id, label]) => ({ id, label }))),
      camps: sortByLabel(Array.from(camps.entries()).map(([id, value]) => ({ id, label: value.label, groupId: value.groupId ?? null }))),
      lands: sortByLabel(Array.from(lands.entries()).map(([id, value]) => ({ id, label: value.label, campId: value.campId ?? null, groupId: value.groupId ?? null }))),
    }
  }

  private datasourceStatusForRows(rows: NormalizedCalculationQueueRow[], mode: CalculationSummaryMode, hasDerivedCredit = false): CalculationSummaryStatus {
    if (!rows.length || !rows.some((row) => row.grossEmissionTco2e != null)) return 'missing'
    if (
      hasDerivedCredit
      || rows.some((row) => row.grossEmissionTco2e == null || !row.calculationBreakdown)
      || (mode === 'credit' && !rows.some((row) => row.creditResultTco2e != null))
    ) {
      return 'api_partial'
    }
    return 'api_real'
  }

  private buildFootprintSummaryRows(
    rows: NormalizedCalculationQueueRow[],
    socRows: Array<{ landId: number | null; campId: number | null; campGroupId: number | null; socTco2e: number }>,
    groupBy: CalculationSummaryGroupBy,
  ): CalculationSummaryRow[] {
    return Array.from(this.groupCalculationRows(rows, groupBy).entries()).map(([key, groupRows]) => {
      const gross = groupRows.reduce((sum, row) => sum + (row.grossEmissionTco2e ?? 0), 0)
      const soc = this.socForRows(groupRows, socRows)
      const area = this.uniqueCalculationArea(groupRows)
      const net = gross - soc
      return {
        id: `${groupBy}:${key}`,
        groupType: groupBy,
        groupLabel: this.groupLabelFromRows(groupBy, groupRows),
        productionYearLabel: groupBy === 'year' ? groupRows[0]?.productionYearLabel : undefined,
        campGroupId: groupRows[0]?.campGroupId ?? null,
        campId: groupRows[0]?.campId ?? null,
        landId: groupRows[0]?.landId ?? null,
        areaRai: round(area, 2),
        grossEmissionTco2e: round(gross, 4),
        socRemovalTco2e: round(soc, 4),
        netEmissionTco2e: round(net, 4),
        intensityTco2ePerRai: area ? round(net / area, 4) : null,
        datasourceStatus: this.datasourceStatusForRows(groupRows, 'footprint'),
        auditItems: groupRows.map((row) => row.auditItem),
      }
    }).sort((left, right) => right.grossEmissionTco2e - left.grossEmissionTco2e)
  }

  private yearLabelsFromRows(rows: NormalizedCalculationQueueRow[]) {
    return this.sortedYearOptions(rows).map((option) => option.value)
  }

  private resolveCreditYears(rows: NormalizedCalculationQueueRow[], query: CalculationSummaryQuery) {
    const labels = this.yearLabelsFromRows(rows)
    const projectYear = query.projectYear && labels.includes(query.projectYear)
      ? query.projectYear
      : labels[labels.length - 1]
    const baselineFromQuery = this.csvValues(query.baselineYears).filter((year) => labels.includes(year) && year !== projectYear)
    const baselineYears = baselineFromQuery.length
      ? baselineFromQuery
      : labels.filter((year) => year !== projectYear).slice(-4)
    return { projectYear, baselineYears }
  }

  private buildCreditSummaryRows(
    rows: NormalizedCalculationQueueRow[],
    socRows: Array<{ landId: number | null; campId: number | null; campGroupId: number | null; socTco2e: number }>,
    groupBy: CalculationSummaryGroupBy,
    projectYear: string | undefined,
    baselineYears: string[],
  ): { rows: CalculationSummaryRow[]; usedDerivedCredit: boolean } {
    const selectedYears = new Set([projectYear, ...baselineYears].filter((value): value is string => Boolean(value)))
    const relevantRows = selectedYears.size ? rows.filter((row) => selectedYears.has(row.productionYearLabel)) : rows
    let usedDerivedCredit = false
    const summaryRows = Array.from(this.groupCalculationRows(relevantRows, groupBy).entries()).map(([key, groupRows]) => {
      const projectRows = projectYear ? groupRows.filter((row) => row.productionYearLabel === projectYear) : []
      const projectGross = projectRows.reduce((sum, row) => sum + (row.grossEmissionTco2e ?? 0), 0)
      const baselineTotals = baselineYears.map((year) => (
        groupRows
          .filter((row) => row.productionYearLabel === year)
          .reduce((sum, row) => sum + (row.grossEmissionTco2e ?? 0), 0)
      ))
      const baselineAvg = baselineTotals.length
        ? baselineTotals.reduce((sum, value) => sum + value, 0) / baselineTotals.length
        : 0
      const soc = this.socForRows(projectRows.length ? projectRows : groupRows, socRows)
      const persistedCredit = projectRows.reduce((sum, row) => sum + (row.creditResultTco2e ?? 0), 0)
      const hasPersistedCredit = projectRows.length > 0 && projectRows.every((row) => row.creditResultTco2e != null)
      const credit = hasPersistedCredit ? persistedCredit : Math.max(0, baselineAvg - projectGross + soc)
      if (!hasPersistedCredit) usedDerivedCredit = true
      const area = this.uniqueCalculationArea(projectRows.length ? projectRows : groupRows)
      const net = projectGross - soc
      return {
        id: `${groupBy}:${key}`,
        groupType: groupBy,
        groupLabel: this.groupLabelFromRows(groupBy, groupRows),
        productionYearLabel: projectYear,
        campGroupId: groupRows[0]?.campGroupId ?? null,
        campId: groupRows[0]?.campId ?? null,
        landId: groupRows[0]?.landId ?? null,
        areaRai: round(area, 2),
        grossEmissionTco2e: round(projectGross, 4),
        socRemovalTco2e: round(soc, 4),
        netEmissionTco2e: round(net, 4),
        creditTco2e: round(credit, 4),
        intensityTco2ePerRai: area ? round(credit / area, 4) : null,
        datasourceStatus: this.datasourceStatusForRows(groupRows, 'credit', !hasPersistedCredit),
        auditItems: groupRows.map((row) => row.auditItem),
      }
    }).sort((left, right) => (right.creditTco2e ?? 0) - (left.creditTco2e ?? 0))

    return { rows: summaryRows, usedDerivedCredit }
  }

  private buildCalculationBreakdowns(rows: NormalizedCalculationQueueRow[], summaryRows: CalculationSummaryRow[]) {
    const formula = new Map<string, number>()
    const resource = new Map<string, number>()
    rows.forEach((row) => {
      this.addSummaryValue(formula, row.formulaMode, row.grossEmissionTco2e)
      this.addSummaryValue(resource, row.resourceName, row.grossEmissionTco2e)
    })

    const yearRows = new Map<string, NormalizedCalculationQueueRow[]>()
    rows.forEach((row) => {
      if (!yearRows.has(row.productionYearLabel)) yearRows.set(row.productionYearLabel, [])
      yearRows.get(row.productionYearLabel)!.push(row)
    })
    const yearOptions = this.sortedYearOptions(rows)

    return {
      emissionByFormula: this.mapSummaryValues(formula).slice(0, 12),
      emissionByResource: this.mapSummaryValues(resource).slice(0, 12),
      emissionByYear: yearOptions.map((option) => {
        const matchingRows = yearRows.get(option.value) ?? []
        const gross = matchingRows.reduce((sum, row) => sum + (row.grossEmissionTco2e ?? 0), 0)
        const netFromSummary = summaryRows
          .filter((row) => row.productionYearLabel === option.value)
          .reduce((sum, row) => sum + row.netEmissionTco2e, 0)
        return {
          year: option.value,
          grossTco2e: round(gross, 4),
          netTco2e: round(netFromSummary || gross, 4),
        }
      }),
    }
  }

  private buildFootprintInsights(kpi: CalculationSummaryRow, rows: CalculationSummaryRow[], missingBreakdownCount: number): CalculationSummaryInsight[] {
    const avgIntensity = rows.length
      ? rows.reduce((sum, row) => sum + (row.intensityTco2ePerRai ?? 0), 0) / rows.filter((row) => row.intensityTco2ePerRai != null).length
      : 0
    const topDriver = [...rows].sort((left, right) => right.grossEmissionTco2e - left.grossEmissionTco2e)[0]
    return [
      {
        type: kpi.netEmissionTco2e <= kpi.grossEmissionTco2e ? 'good' : 'info',
        title: 'Net Emissions',
        detail: `Gross ${round(kpi.grossEmissionTco2e, 2)} tCO2e หัก SOC ${round(kpi.socRemovalTco2e, 2)} tCO2e`,
        value: `${round(kpi.netEmissionTco2e, 2)} tCO2e`,
      },
      {
        type: topDriver ? 'warning' : 'info',
        title: 'Top emission driver',
        detail: topDriver ? `${topDriver.groupLabel} เป็นกลุ่มที่ปล่อยสูงสุดในมุมมองนี้` : 'ยังไม่มีข้อมูล emission สำหรับจัดอันดับ',
        value: topDriver ? `${round(topDriver.grossEmissionTco2e, 2)} tCO2e` : '—',
      },
      {
        type: missingBreakdownCount > 0 ? 'warning' : 'good',
        title: 'Data quality',
        detail: missingBreakdownCount > 0
          ? 'มี queue ที่มีผลลัพธ์แต่ยังไม่มี calculation breakdown สำหรับ audit เต็ม'
          : 'รายการที่คำนวณแล้วมี calculation breakdown พร้อมใช้ตรวจสอบ',
        value: `${missingBreakdownCount.toLocaleString('th-TH')} missing`,
      },
      {
        type: 'info',
        title: 'Benchmarking',
        detail: 'ค่า intensity เฉลี่ยของแถวสรุปใน scope ปัจจุบัน',
        value: Number.isFinite(avgIntensity) ? `${round(avgIntensity, 4)} tCO2e/ไร่` : '—',
      },
    ]
  }

  private buildCreditInsights(
    kpi: CalculationSummaryRow,
    rows: CalculationSummaryRow[],
    projectYear: string | undefined,
    baselineYears: string[],
    baselineAvgTotal: number,
    usedDerivedCredit: boolean,
  ): CalculationSummaryInsight[] {
    const reduction = baselineAvgTotal - kpi.grossEmissionTco2e
    const topCredit = [...rows].sort((left, right) => (right.creditTco2e ?? 0) - (left.creditTco2e ?? 0))[0]
    const progress = kpi.grossEmissionTco2e ? ((kpi.creditTco2e ?? 0) / kpi.grossEmissionTco2e) * 100 : 0
    return [
      {
        type: progress >= 80 ? 'good' : 'info',
        title: 'Net-Zero Progress',
        detail: `Credit เทียบกับ gross emission ของปีโครงการ ${projectYear ?? '-'}`,
        value: `${round(progress, 1)}%`,
      },
      {
        type: reduction >= 0 ? 'good' : 'warning',
        title: 'Baseline average vs Project',
        detail: `ปีฐาน ${baselineYears.join(', ') || '-'} เทียบปีโครงการ ${projectYear ?? '-'}`,
        value: `${reduction >= 0 ? 'ลดลง' : 'เพิ่มขึ้น'} ${round(Math.abs(reduction), 2)} tCO2e`,
      },
        {
          type: usedDerivedCredit ? 'warning' : 'good',
          title: 'Credit source',
          detail: usedDerivedCredit
            ? 'ผลเครดิตที่บันทึกไว้ยังมีไม่ครบทุกส่วน จึงแสดงค่าเบื้องต้นจากค่าอ้างอิง ปีโครงการ และ SOC'
            : 'ใช้ผลเครดิตที่ระบบบันทึกไว้แล้ว',
          value: usedDerivedCredit ? 'API partial' : 'API real',
        },
      {
        type: topCredit ? 'info' : 'warning',
        title: 'Assessment readiness',
        detail: topCredit ? `${topCredit.groupLabel} เป็นกลุ่มที่มี credit สูงสุดในมุมมองนี้` : 'ยังไม่มีแถว credit สำหรับประเมินต่อ',
        value: topCredit ? `${round(topCredit.creditTco2e ?? 0, 2)} tCO2e` : '—',
      },
    ]
  }

  private normalizeCalStatusName(value: string | null | undefined) {
    return (value ?? '').trim().toLowerCase()
  }

  private isCalculatedStatusName(name: string) {
    const looksDone = /คำนวณแล้ว|done|success|สำเร็จ/.test(name)
    const looksPending = /pending|wait|รอ|ยังไม่/.test(name)
    const looksError = /error|fail|ผิด/.test(name)
    return looksDone && !looksPending && !looksError
  }

  private async getCalculatedStatusIds() {
    const now = Date.now()
    if (this.calculatedStatusIdsCache && this.calculatedStatusIdsCache.expiresAt > now) {
      return this.calculatedStatusIdsCache.ids
    }
    if (this.calculatedStatusIdsRequest) return this.calculatedStatusIdsRequest

    const request = this.prisma.log_act_detail_calStatus.findMany({
      select: {
        log_act_detail_calStatus_id: true,
        log_act_detail_calStatus_name: true,
      },
      orderBy: { log_act_detail_calStatus_id: 'asc' },
    })
      .then((statuses) => {
        const matchedIds = statuses
          .filter((status) => this.isCalculatedStatusName(this.normalizeCalStatusName(status.log_act_detail_calStatus_name)))
          .map((status) => status.log_act_detail_calStatus_id)
        const ids = matchedIds.length > 0 ? matchedIds : [2]
        this.calculatedStatusIdsCache = {
          expiresAt: Date.now() + this.calculatedStatusCacheTtlMs,
          ids,
        }
        return ids
      })
      .finally(() => {
        this.calculatedStatusIdsRequest = null
      })

    this.calculatedStatusIdsRequest = request
    return request
  }

  async getSummary() {
    type Row = { total_records: bigint; total_volume: number; total_areawork: number }
    const calculatedStatusIds = await this.getCalculatedStatusIds()
    const [row] = await this.prisma.$queryRaw<Row[]>`
      SELECT
        COUNT(*) AS total_records,
        COALESCE(SUM("log_act_detail_volumeAll"), 0) AS total_volume,
        COALESCE(SUM("log_act_detail_areawork"), 0) AS total_areawork
      FROM log_activities_detail
      WHERE "log_act_detail_calStatus_id" IN (${Prisma.join(calculatedStatusIds)})
    `
    return {
      total_records: Number(row?.total_records ?? 0),
      total_volume: round(n(row?.total_volume)),
      total_areawork: round(n(row?.total_areawork)),
    }
  }

  async getByCamp() {
    type Row = { camp_id: number; camp_name: string | null; co2e: number }
    const calculatedStatusIds = await this.getCalculatedStatusIds()
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT
        lc.land_camp_id AS camp_id,
        lc.land_camp_name AS camp_name,
        COALESCE(SUM(ld."log_act_detail_volumeAll"), 0) AS co2e
      FROM lands_camps lc
      LEFT JOIN lands l ON l.land_camp_id = lc.land_camp_id
      LEFT JOIN activities_header ah ON ah.land_id = l.land_id
      LEFT JOIN log_activities_detail ld
        ON ld.activities_header_id = ah.activities_header_id
        AND ld."log_act_detail_calStatus_id" IN (${Prisma.join(calculatedStatusIds)})
      GROUP BY lc.land_camp_id, lc.land_camp_name
      ORDER BY lc.land_camp_id
    `
    return rows.map((row) => ({
      camp_id: row.camp_id,
      camp_name: row.camp_name,
      co2e: round(n(row.co2e)),
    }))
  }

  async getByActivity() {
    type Row = { activity_type_id: number; activity_type: string | null; co2e: number }
    const calculatedStatusIds = await this.getCalculatedStatusIds()
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT
        ht.act_header_type_id AS activity_type_id,
        ht."act_header_type_name_th" AS activity_type,
        COALESCE(SUM(ld."log_act_detail_volumeAll"), 0) AS co2e
      FROM activities_header_type ht
      LEFT JOIN activities_header ah ON ah.act_header_type_id = ht.act_header_type_id
      LEFT JOIN log_activities_detail ld
        ON ld.activities_header_id = ah.activities_header_id
        AND ld."log_act_detail_calStatus_id" IN (${Prisma.join(calculatedStatusIds)})
      GROUP BY ht.act_header_type_id, ht."act_header_type_name_th"
      ORDER BY ht.act_header_type_id
    `
    return rows.map((row) => ({
      activity_type_id: row.activity_type_id,
      activity_type: row.activity_type,
      co2e: round(n(row.co2e)),
    }))
  }

  async getByLand(campId?: number) {
    type Row = { land_id: number; land_code: string | null; land_name: string | null; camp_name: string | null; co2e: number }
    const calculatedStatusIds = await this.getCalculatedStatusIds()
    const rows = campId
      ? await this.prisma.$queryRaw<Row[]>`
          SELECT
            l.land_id,
            l.land_code,
            l.name AS land_name,
            lc.land_camp_name AS camp_name,
            COALESCE(SUM(ld."log_act_detail_volumeAll"), 0) AS co2e
          FROM lands l
          LEFT JOIN lands_camps lc ON lc.land_camp_id = l.land_camp_id
          LEFT JOIN activities_header ah ON ah.land_id = l.land_id
          LEFT JOIN log_activities_detail ld
            ON ld.activities_header_id = ah.activities_header_id
            AND ld."log_act_detail_calStatus_id" IN (${Prisma.join(calculatedStatusIds)})
          WHERE l.land_camp_id = ${campId}
          GROUP BY l.land_id, l.land_code, l.name, lc.land_camp_name
          ORDER BY l.land_id
        `
      : await this.prisma.$queryRaw<Row[]>`
          SELECT
            l.land_id,
            l.land_code,
            l.name AS land_name,
            lc.land_camp_name AS camp_name,
            COALESCE(SUM(ld."log_act_detail_volumeAll"), 0) AS co2e
          FROM lands l
          LEFT JOIN lands_camps lc ON lc.land_camp_id = l.land_camp_id
          LEFT JOIN activities_header ah ON ah.land_id = l.land_id
          LEFT JOIN log_activities_detail ld
            ON ld.activities_header_id = ah.activities_header_id
            AND ld."log_act_detail_calStatus_id" IN (${Prisma.join(calculatedStatusIds)})
          GROUP BY l.land_id, l.land_code, l.name, lc.land_camp_name
          ORDER BY l.land_id
        `
    return rows.map((row) => ({
      land_id: row.land_id,
      land_code: row.land_code,
      land_name: row.land_name,
      camp_name: row.camp_name,
      co2e: round(n(row.co2e)),
    }))
  }

  async getMultiCampComparison(campIds: number[]) {
    if (!campIds.length) return []
    const camps = await this.getByCamp()
    return camps.filter((camp) => campIds.includes(camp.camp_id))
  }

  async getCfKpi(filter: ReportFilter = {}) {
    const rows = this.applyFilter(await this.getEmissionRows(), filter)
    const meta = this.getYearMeta(rows)
    const currentEmission = this.sumForYears(rows, meta.currentYear ? [meta.currentYear] : [])
    const baselineAvgEmission = this.baselineAverage(rows, meta)
    const currentRows = meta.currentYear ? rows.filter((row) => emissionRowYearLabel(row) === meta.currentYear) : []
    const machineEmission = currentRows
      .filter((row) => /เครื่อง|fuel|น้ำมัน|diesel|รถ|machine/i.test(`${row.process ?? ''} ${row.activity ?? ''}`))
      .reduce((sum, row) => sum + n(row.co2e), 0)
    const fertilizerRows = currentRows
      .filter((row) => /ปุ๋ย|สาร|chemical|fertilizer|input/i.test(`${row.process ?? ''} ${row.activity ?? ''}`))
    const inputEmission = fertilizerRows.reduce((sum, row) => sum + n(row.co2e), 0)
    const fertilizerAmountKg = fertilizerRows.reduce((sum, row) => sum + n(row.input_amount), 0)
    const farmers = new Set(currentRows.map((row) => row.farmer_id).filter(Boolean)).size
    const fields = new Set(currentRows.map((row) => row.land_id).filter(Boolean)).size
    const totalArea = this.uniqueArea(currentRows)
    const creditTotalTco2e = currentRows.reduce((sum, row) => sum + n(row.credit_co2e), 0)
    const socByLand = new Map<number, number>()
    currentRows.forEach((row) => {
      if (row.land_id) socByLand.set(row.land_id, Math.max(socByLand.get(row.land_id) ?? 0, n(row.actual_soc)))
    })
    const socRemovalTco2e = Array.from(socByLand.values()).reduce((sum, value) => sum + value, 0)
    const creditCalculatedRows = currentRows.filter((row) => n(row.credit_co2e) > 0).length

    return {
      baselineAvgEmission: round(baselineAvgEmission),
      currentEmission: round(currentEmission),
      currentYear: meta.currentYear ?? '-',
      machineEmission: round(machineEmission),
      inputEmission: round(inputEmission),
      fertilizerAmountKg: round(fertilizerAmountKg, 1),
      fertilizerEmission: round(inputEmission),
      areaRai: round(totalArea),
      yieldTon: 0,
      co2ePerTon: totalArea ? round(currentEmission / totalArea, 3) : 0,
      farmers,
      fields,
      creditTotalTco2e: round(creditTotalTco2e, 4),
      socRemovalTco2e: round(socRemovalTco2e, 4),
      creditCalculatedRows,
      years: meta.years,
      baselineYears: meta.baselineYears,
    }
  }

  async getCfTrend(filter: ReportFilter = {}) {
    const rows = this.applyFilter(await this.getEmissionRows(), filter)
    const meta = this.getYearMeta(rows)
    return meta.years.map((year) => ({
      year,
      emission: round(this.sumForYears(rows, [year])),
      isBaseline: year !== meta.currentYear,
      baselineAverage: round(this.baselineAverage(rows, meta)),
    }))
  }

  async getCfProcess(filter: ReportFilter = {}) {
    const rows = this.applyFilter(await this.getEmissionRows(), filter).filter((row) => !isTransport(row))
    return this.buildProcessEmissions(rows)
  }

  async getCfTransport(filter: ReportFilter = {}) {
    const rows = this.applyFilter(await this.getEmissionRows(), filter).filter(isTransport)
    return this.buildProcessEmissions(rows)
  }

  async getCfProcessActivities(kind: 'process' | 'transport' | 'all' = 'all', filter: ReportFilter = {}) {
    let rows = this.applyFilter(await this.getEmissionRows(), filter)
    if (kind === 'process') rows = rows.filter((row) => !isTransport(row))
    if (kind === 'transport') rows = rows.filter(isTransport)
    return this.buildProcessActivities(rows)
  }

  async getCfProcessInputs(filter: ReportFilter = {}) {
    const rows = this.applyFilter(await this.getEmissionRows(), filter).filter((row) => !isTransport(row))
    return this.buildProcessInputs(rows)
  }

  async getCfCaneTypes(filter: ReportFilter = {}) {
    const rows = this.applyFilter(await this.getEmissionRows(), filter).filter((row) => !isTransport(row))
    const meta = this.getYearMeta(rows)
    const selectedRows = meta.currentYear ? rows.filter((row) => emissionRowYearLabel(row) === meta.currentYear) : rows
    const totalArea = this.uniqueArea(selectedRows)
    const byCaneType = new Map<string, { areaByLand: Map<number, number>; co2eTotal: number }>()

    selectedRows.forEach((row) => {
      const name = labelOr(row.cane_type_name, 'ไม่ระบุประเภทอ้อย')
      const bucket = byCaneType.get(name) ?? { areaByLand: new Map<number, number>(), co2eTotal: 0 }
      if (row.land_id) bucket.areaByLand.set(row.land_id, Math.max(bucket.areaByLand.get(row.land_id) ?? 0, n(row.land_area)))
      bucket.co2eTotal += n(row.co2e)
      byCaneType.set(name, bucket)
    })

    return Array.from(byCaneType.entries())
      .map(([name, value]) => {
        const areaRai = Array.from(value.areaByLand.values()).reduce((sum, area) => sum + area, 0)
        return {
          name,
          areaRai: round(areaRai, 1),
          percent: totalArea ? round((areaRai / totalArea) * 100, 1) : 0,
          co2eTotal: round(value.co2eTotal),
        }
      })
      .sort((a, b) => b.areaRai - a.areaRai)
  }

  async getCfCamps(year?: string) {
    const rows = await this.getEmissionRows()
    const camps = new Map<number, EmissionRow[]>()
    rows.forEach((row) => {
      const campId = this.presentationCampId(row)
      if (!camps.has(campId)) camps.set(campId, [])
      camps.get(campId)!.push(row)
    })
    const targetYearLabel = year && year !== 'project' ? String(year) : undefined

    return Array.from(camps.entries())
      .map(([campId, campRows]) => {
        const meta = this.getYearMeta(campRows)
        const currentYear = targetYearLabel ?? meta.currentYear ?? ''
        const currentRows = currentYear ? campRows.filter((row) => emissionRowYearLabel(row) === currentYear) : []
        const activities = this.buildProcessActivities(campRows)
        const baselineProcessActivities = activities.filter((row) => row.year === 'baseline_avg')
        const currentProcessActivities = activities.filter((row) => row.year === currentYear)
        const baselineActivityBreakdown = baselineProcessActivities.map((row) => ({ name: row.process, emission: row.totalEmission }))
        const currentActivityBreakdown = currentProcessActivities.map((row) => ({ name: row.process, emission: row.totalEmission }))
        const currentCo2eTotal = currentActivityBreakdown.reduce((sum, item) => sum + item.emission, 0)
        const areaRai = this.uniqueArea(currentRows.length ? currentRows : campRows)
        const topActivity = [...currentActivityBreakdown].sort((a, b) => b.emission - a.emission)[0]?.name ?? '-'

        return {
          campId,
          campName: labelOr(campRows[0]?.camp_name, campId === -1 ? 'Unassigned camp' : `Camp ${campId}`),
          fieldCount: new Set(currentRows.map((row) => row.land_id).filter(Boolean)).size,
          areaRai: round(areaRai),
          baselineCo2eTotal: round(this.baselineAverage(campRows, meta)),
          currentCo2eTotal: round(currentCo2eTotal),
          co2eTotal: round(currentCo2eTotal),
          co2ePerRai: areaRai ? round(currentCo2eTotal / areaRai, 3) : 0,
          topActivity,
          baselineActivityBreakdown,
          currentActivityBreakdown,
          baselineProcessActivities,
          currentProcessActivities,
          processInputComparisons: this.buildProcessInputs(campRows),
          calculationBreakdowns: this.calculationBreakdowns(campRows),
        }
      })
      .sort((a, b) => b.co2eTotal - a.co2eTotal)
  }

  async getCfCampFields(campId?: number, year?: string) {
    const rows = await this.getEmissionRows()
    const selectedRows = campId
      ? rows.filter((row) => this.presentationCampId(row) === campId || row.camp_id === campId)
      : rows
    const byLand = new Map<number, EmissionRow[]>()
    selectedRows.forEach((row) => {
      if (!row.land_id) return
      if (!byLand.has(row.land_id)) byLand.set(row.land_id, [])
      byLand.get(row.land_id)!.push(row)
    })
    const targetYearLabel = year && year !== 'project' ? String(year) : undefined

    return Array.from(byLand.entries()).map(([landId, landRows]) => {
      const node = this.buildSpatialNodes(landRows, targetYearLabel).find((item) => item.level === 'field')
      const first = landRows[0]
      const currentYear = targetYearLabel ?? this.getYearMeta(landRows).currentYear
      const activitiesLogged = Array.from(new Set(
        landRows
          .filter((row) => emissionRowYearLabel(row) === currentYear)
          .map((row) => labelOr(row.activity, '-')),
      ))

      return {
        ...(node ?? {
          id: `field-${landId}`,
          level: 'field' as const,
          name: labelOr(first.land_name, first.land_code ?? `Field ${landId}`),
          lat: n(first.land_lat) || n(first.subdistrict_lat) || n(first.camp_lat) || 13,
          lng: n(first.land_lng) || n(first.subdistrict_lng) || n(first.camp_lng) || 101,
          zoom: 15,
          fields: 1,
          farmers: first.farmer_id ? 1 : 0,
          areaRai: n(first.land_area),
          baselineEmission: 0,
          currentEmission: 0,
          processBreakdown: [],
          childrenIds: [],
          calStatusId: 0,
          actualCredit: 0,
          actualSoc: 0,
        }),
        fieldCode: first.land_code ?? '',
        fieldName: labelOr(first.land_name, first.land_code ?? ''),
        farmerName: first.farmer_name ?? '',
        phone: first.phone ?? '',
        province: first.province_name ?? '',
        district: first.district_name ?? '',
        subdistrict: first.subdistrict_name ?? '',
        soilType: '',
        irrigationType: '',
        chanots: [],
        campId: this.presentationCampId(first),
        campName: labelOr(first.camp_name, 'Unassigned camp'),
        activitiesLogged,
        co2eTotal: round(node?.currentEmission ?? 0),
        processInputComparisons: this.buildProcessInputs(landRows),
        calculationBreakdowns: this.calculationBreakdowns(landRows),
      }
    })
  }

  async getCfSpatialNodes(filter: ReportFilter = {}) {
    const rows = await this.getEmissionRows()
    const targetYear = filter.year && filter.year !== 'project' ? String(filter.year) : undefined
    const nodes = this.buildSpatialNodes(rows, targetYear)
    if (!filter.level || filter.level === 'all' || !filter.id) return nodes
    const selected = nodes.find((node) => node.id === `${filter.level}-${filter.id}` || node.id === filter.id)
    if (!selected) return nodes
    const keep = new Set<string>()
    const visit = (node: SpatialNode) => {
      keep.add(node.id)
      node.childrenIds.forEach((childId) => {
        const child = nodes.find((candidate) => candidate.id === childId)
        if (child) visit(child)
      })
    }
    visit(selected)
    let parentId = selected.parentId
    while (parentId) {
      keep.add(parentId)
      parentId = nodes.find((node) => node.id === parentId)?.parentId
    }
    return nodes.filter((node) => keep.has(node.id))
  }

  async getCalculationSummary(query: CalculationSummaryQuery = {}) {
    const mode = this.calculationSummaryMode(query.mode)
    const scope = this.calculationSummaryScope(query.scope)
    const groupBy = this.calculationSummaryGroupBy(query.groupBy, mode, scope)
    const [allRows, socRows] = await Promise.all([
      this.getCalculationSummaryQueueRows(),
      this.getCalculationSummarySocRows(),
    ])
    const filters = this.buildCalculationFilters(allRows)
    const selectedRows = this.applyCalculationSummaryFilters(allRows, query)
    const calculatedRows = selectedRows.filter((row) => row.grossEmissionTco2e != null)
    const missingBreakdownCount = calculatedRows.filter((row) => !row.calculationBreakdown).length
    const notes = new Set<string>()

    if (!selectedRows.length) notes.add('ไม่พบ queue ที่ตรงกับตัวกรองปัจจุบัน')
    if (missingBreakdownCount > 0) notes.add('มี queue ที่มีผลลัพธ์แต่ไม่มี calculation breakdown ควรคำนวณใหม่ถ้าต้อง audit เต็ม')
    if (socRows.length > 0) notes.add('ข้อมูล SOC/Fnfix ในสรุปนี้อ้างอิงตามแปลงเป็นหลัก และบางรายการยังเชื่อมกับปีการผลิตได้ไม่ครบทุกกรณี')

    let summaryRows: CalculationSummaryRow[] = []
    let usedDerivedCredit = false
    let projectYear: string | undefined
    let baselineYears: string[] = []
    let baselineAvgTotal = 0
    let breakdownSourceRows = selectedRows

    if (mode === 'credit') {
      const resolvedCreditYears = this.resolveCreditYears(selectedRows, query)
      projectYear = resolvedCreditYears.projectYear
      baselineYears = resolvedCreditYears.baselineYears
      const creditSummary = this.buildCreditSummaryRows(selectedRows, socRows, groupBy, projectYear, baselineYears)
      summaryRows = creditSummary.rows
      usedDerivedCredit = creditSummary.usedDerivedCredit
      const creditYearSet = new Set([projectYear, ...baselineYears].filter((value): value is string => Boolean(value)))
      breakdownSourceRows = creditYearSet.size ? selectedRows.filter((row) => creditYearSet.has(row.productionYearLabel)) : selectedRows
      baselineAvgTotal = baselineYears.length
        ? baselineYears.reduce((sum, year) => (
          sum + selectedRows
            .filter((row) => row.productionYearLabel === year)
            .reduce((yearSum, row) => yearSum + (row.grossEmissionTco2e ?? 0), 0)
        ), 0) / baselineYears.length
        : 0
      if (usedDerivedCredit) notes.add('Carbon Credit ในสรุปนี้แสดงค่าเบื้องต้นจากข้อมูลที่มีอยู่ เพราะผลเครดิตที่บันทึกไว้ยังไม่ครบทุกส่วน')
      if (!baselineYears.length || !projectYear) notes.add('ยังเลือก baseline/project year ไม่ครบสำหรับการประเมิน Carbon Credit')
    } else {
      summaryRows = this.buildFootprintSummaryRows(selectedRows, socRows, groupBy)
    }

    const grossEmissionTco2e = mode === 'credit'
      ? summaryRows.reduce((sum, row) => sum + row.grossEmissionTco2e, 0)
      : calculatedRows.reduce((sum, row) => sum + (row.grossEmissionTco2e ?? 0), 0)
    const socRemovalTco2e = mode === 'credit'
      ? summaryRows.reduce((sum, row) => sum + row.socRemovalTco2e, 0)
      : this.socForRows(selectedRows, socRows)
    const netEmissionTco2e = grossEmissionTco2e - socRemovalTco2e
    const areaRai = this.uniqueCalculationArea(mode === 'credit' && projectYear
      ? selectedRows.filter((row) => row.productionYearLabel === projectYear)
      : selectedRows)
    const creditTco2e = mode === 'credit'
      ? summaryRows.reduce((sum, row) => sum + (row.creditTco2e ?? 0), 0)
      : undefined
    const kpiRow: CalculationSummaryRow = {
      id: 'summary',
      groupType: groupBy,
      groupLabel: 'ภาพรวม',
      areaRai: round(areaRai, 2),
      grossEmissionTco2e: round(grossEmissionTco2e, 4),
      socRemovalTco2e: round(socRemovalTco2e, 4),
      netEmissionTco2e: round(netEmissionTco2e, 4),
      creditTco2e: creditTco2e == null ? undefined : round(creditTco2e, 4),
      intensityTco2ePerRai: areaRai ? round((mode === 'credit' ? (creditTco2e ?? 0) : netEmissionTco2e) / areaRai, 4) : null,
      datasourceStatus: this.datasourceStatusForRows(selectedRows, mode, usedDerivedCredit),
      auditItems: selectedRows.map((row) => row.auditItem),
    }
    const datasourceStatus = this.datasourceStatusForRows(selectedRows, mode, usedDerivedCredit)
    const insights = mode === 'credit'
      ? this.buildCreditInsights(kpiRow, summaryRows, projectYear, baselineYears, baselineAvgTotal, usedDerivedCredit)
      : this.buildFootprintInsights(kpiRow, summaryRows, missingBreakdownCount)

    return {
      mode,
      datasourceStatus,
      notes: Array.from(notes),
      filters,
      kpi: {
        areaRai: kpiRow.areaRai,
        rowCount: selectedRows.length,
        calculatedCount: calculatedRows.length,
        missingBreakdownCount,
        grossEmissionTco2e: kpiRow.grossEmissionTco2e,
        socRemovalTco2e: kpiRow.socRemovalTco2e,
        netEmissionTco2e: kpiRow.netEmissionTco2e,
        ...(kpiRow.creditTco2e !== undefined ? { creditTco2e: kpiRow.creditTco2e } : {}),
        intensityTco2ePerRai: kpiRow.intensityTco2ePerRai,
      },
      breakdowns: this.buildCalculationBreakdowns(breakdownSourceRows, summaryRows),
      rows: summaryRows,
      insights,
    }
  }

  async getCfReportSummary(filter: ReportFilter = {}) {
    const [kpi, trend, process, transport, processInputs, spatialNodes] = await Promise.all([
      this.getCfKpi(filter),
      this.getCfTrend(filter),
      this.getCfProcess(filter),
      this.getCfTransport(filter),
      this.getCfProcessInputs(filter),
      this.getCfSpatialNodes(filter),
    ])
    const processCurrent = process.filter((item) => !item.isBaseline && item.year === kpi.currentYear)
    const transportCurrent = transport.filter((item) => !item.isBaseline && item.year === kpi.currentYear)
    const topProcess = [...processCurrent].sort((a, b) => b.emission - a.emission)[0]
    const lowProcess = [...processCurrent].filter((item) => item.emission > 0).sort((a, b) => a.emission - b.emission)[0]
    const topTransport = [...transportCurrent].sort((a, b) => b.emission - a.emission)[0]
    const root = spatialNodes.find((node) => node.level === 'country') ?? spatialNodes[0]
    const diff = kpi.baselineAvgEmission - kpi.currentEmission
    const direction = diff >= 0 ? 'ลดลง' : 'เพิ่มขึ้น'

    return {
      generatedAt: new Date().toISOString(),
      filter: {
        level: filter.level ?? 'all',
        id: filter.id ?? '',
        ...(filter.year ? { year: String(filter.year) } : {}),
      },
      kpi,
      trend,
      process,
      transport,
      processInputs,
      spatialNodes,
      analysis: {
        headline: `ปีดำเนินโครงการ ${kpi.currentYear} ปล่อยคาร์บอน${direction} ${round(Math.abs(diff))} tCO2e เทียบกับค่าเฉลี่ยปีฐาน`,
        topProcess: topProcess ? `${topProcess.process} (${round(topProcess.emission)} tCO2e)` : '-',
        lowProcess: lowProcess ? `${lowProcess.process} (${round(lowProcess.emission)} tCO2e)` : '-',
        topTransport: topTransport ? `${topTransport.process} (${round(topTransport.emission)} tCO2e)` : '-',
        areaSummary: root ? `${root.name}: ${root.fields} แปลง, ${round(root.areaRai)} ไร่` : '-',
      },
    }
  }

  private async getEmissionRows(): Promise<EmissionRow[]> {
    const now = Date.now()
    if (this.emissionRowsCache && this.emissionRowsCache.expiresAt > now) {
      return this.emissionRowsCache.rows
    }
    if (this.emissionRowsRequest) return this.emissionRowsRequest

    const request = this.loadEmissionRows()
      .then((rows) => {
        this.emissionRowsCache = {
          expiresAt: Date.now() + this.emissionRowsCacheTtlMs,
          rows,
        }
        return rows
      })
      .finally(() => {
        this.emissionRowsRequest = null
      })

    this.emissionRowsRequest = request
    return request
  }

  private async loadEmissionRows(): Promise<EmissionRow[]> {
    const calculatedStatusIds = await this.getCalculatedStatusIds()
    return this.prisma.$queryRaw<EmissionRow[]>`
      SELECT
        cpq.carbon_process_queue_id AS queue_id,
        EXTRACT(YEAR FROM COALESCE(
          ah."activities_header_startDate",
          ah."activities_header_create_at"
        ))::int AS year,
        COALESCE(
          apy."act_productYear_name",
          NULL
        ) AS production_year_label,
        COALESCE(
          CASE
            WHEN apy."act_productYear_name" ~ '\m(24\d{2}|25\d{2}|26\d{2}|19\d{2}|20\d{2}|21\d{2})\M'
              THEN (regexp_match(apy."act_productYear_name", '\m(24\d{2}|25\d{2}|26\d{2}|19\d{2}|20\d{2}|21\d{2})\M'))[1]::int
            WHEN apy."act_productYear_name" ~ '\m\d{2}(?:\s*/\s*\d{2})?\M'
              THEN 2500 + (regexp_match(apy."act_productYear_name", '\m(\d{2})(?:\s*/\s*\d{2})?\M'))[1]::int
            WHEN ah."activities_header_startDate" IS NOT NULL
              THEN EXTRACT(YEAR FROM ah."activities_header_startDate")::int + 543
            WHEN ah."activities_header_create_at" IS NOT NULL
              THEN EXTRACT(YEAR FROM ah."activities_header_create_at")::int + 543
            ELSE NULL
          END,
          NULL
        ) AS production_year_sort_key,
        CASE
          WHEN cpq."carbon_process_queue_resultValue" IS NULL THEN 0
          WHEN LOWER(COALESCE(ru.unit_initial, ru.unit_name, '')) LIKE '%kg%' THEN cpq."carbon_process_queue_resultValue"::numeric / 1000
          WHEN LOWER(COALESCE(ru.unit_initial, ru.unit_name, '')) LIKE '%กิโล%' THEN cpq."carbon_process_queue_resultValue"::numeric / 1000
          ELSE cpq."carbon_process_queue_resultValue"::numeric
        END AS co2e,
        CASE
          WHEN cpq."carbon_process_queue_resultValueCreditCalc" IS NULL THEN 0
          WHEN LOWER(COALESCE(cru.unit_initial, cru.unit_name, '')) LIKE '%kg%' THEN cpq."carbon_process_queue_resultValueCreditCalc"::numeric / 1000
          WHEN LOWER(COALESCE(cru.unit_initial, cru.unit_name, '')) LIKE '%กิโล%' THEN cpq."carbon_process_queue_resultValueCreditCalc"::numeric / 1000
          ELSE cpq."carbon_process_queue_resultValueCreditCalc"::numeric
        END AS credit_co2e,
        COALESCE(soc.soc_tco2e, 0) AS actual_soc,
        COALESCE(cpq."log_act_detail_calStatus_id", ld."log_act_detail_calStatus_id") AS cal_status_id,
        cpq."carbon_process_queue_info" AS queue_info,
        COALESCE(
          ld."log_act_detail_volumeAll",
          ld."log_act_detail_quatity" * ld."log_act_detail_volumePerUnit",
          0
        ) AS input_amount,
        COALESCE(ld."log_act_detail_areawork", 0) AS area_work,
        COALESCE(ht."act_header_type_name_th", ht."act_header_type_name_en", 'ไม่ระบุกระบวนการ') AS process,
        COALESCE(hdt."act_header_detail_type_name_th", 'อื่นๆ') AS activity,
        htsc."act_header_typeSugarCane_name" AS cane_type_name,
        l.land_id,
        l.land_code,
        l.name AS land_name,
        COALESCE(l.area_size, l.land_size) AS land_area,
        l.latitude::text AS land_lat,
        l.longitude::text AS land_lng,
        lc.land_camp_id AS camp_id,
        lc.land_camp_name AS camp_name,
        lc.land_camp_latitude::text AS camp_lat,
        lc.land_camp_longitude::text AS camp_lng,
        f.farmer_id,
        CONCAT_WS(' ', f.first_name, f.last_name) AS farmer_name,
        f.phone,
        g.geographies_id AS region_id,
        g.name AS region_name,
        p.provinces_id AS province_id,
        p.name_th AS province_name,
        d.districts_id AS district_id,
        d.name_th AS district_name,
        sd.subdistricts_id AS subdistrict_id,
        sd.name_th AS subdistrict_name,
        sd.latitude::text AS subdistrict_lat,
        sd.longitude::text AS subdistrict_lng
      FROM log_activities_detail ld
      JOIN activities_header ah ON ah.activities_header_id = ld.activities_header_id
      JOIN carbon_process_queue cpq
        ON cpq.log_act_detail_id = ld.log_act_detail_id
        AND cpq."carbon_process_queue_resultValue" IS NOT NULL
      LEFT JOIN units ru ON ru.unit_id = cpq."unit_id_resultValue"
      LEFT JOIN units cru ON cru.unit_id = cpq."unit_id_resultValueCreditCalc"
      LEFT JOIN activities_header_type ht ON ht.act_header_type_id = COALESCE(ld.act_header_type_id, ah.act_header_type_id)
      LEFT JOIN activities_header_detail_type hdt ON hdt.act_header_detail_type_id = ld.act_header_detail_type_id
      LEFT JOIN "activities_header_typeSugarCane" htsc ON htsc."act_header_typeSugarCane_id" = ah."act_header_typeSugarCane_id"
      LEFT JOIN "activities_productYear" apy ON apy."act_productYear_id" = ld."act_productYear_id"
      LEFT JOIN lands l ON l.land_id = COALESCE(cpq.land_id, ah.land_id)
      LEFT JOIN lands_camps lc ON lc.land_camp_id = COALESCE(cpq.land_camp_id, l.land_camp_id)
      LEFT JOIN (
        SELECT
          land_id,
          SUM(COALESCE("carbon_soc_socIT", 0))::numeric AS soc_tco2e
        FROM carbon_soc
        GROUP BY land_id
      ) soc ON soc.land_id = l.land_id
      LEFT JOIN farmers f ON f.farmer_id = COALESCE(ah.farmer_id, l.farmer_id)
      LEFT JOIN subdistricts sd ON sd.subdistricts_id = l.subdistrict_code
      LEFT JOIN districts d ON d.districts_id = sd.district_code
      LEFT JOIN provinces p ON p.provinces_id = d.province_code
      LEFT JOIN geographies g ON g.geographies_id = p.geography_id
    `
  }

  private getYearMeta(rows: EmissionRow[]): YearMeta {
    const yearMetaByLabel = new Map<string, number>()

    rows.forEach((row) => {
      const label = emissionRowYearLabel(row)
      if (!label) return
      const sortYear = row.production_year_sort_key
        ?? resolveProductionYearSortYear(row.production_year_label, row.year != null ? new Date(row.year, 0, 1) : null)
        ?? Number.MAX_SAFE_INTEGER
      const existing = yearMetaByLabel.get(label)
      if (existing == null || sortYear < existing) yearMetaByLabel.set(label, sortYear)
    })

    const years = Array.from(yearMetaByLabel.entries())
      .sort((left, right) => {
        if (left[1] !== right[1]) return left[1] - right[1]
        return left[0].localeCompare(right[0], 'th')
      })
      .map(([label]) => label)
    const currentYear = years[years.length - 1]
    return {
      years,
      currentYear,
      baselineYears: currentYear ? years.filter((year) => year !== currentYear) : [],
    }
  }

  private applyFilter(rows: EmissionRow[], filter: ReportFilter): EmissionRow[] {
    const yearFiltered = filter.year && filter.year !== 'project'
      ? rows.filter((row) => emissionRowYearLabel(row) === String(filter.year))
      : rows
    if (!filter.level || filter.level === 'all' || !filter.id) return yearFiltered
    if (filter.level === 'region' && (filter.id === 'dan-chang' || filter.id === 'isan')) {
      return yearFiltered.filter((row) => this.farmGroupForRow(row) === filter.id)
    }
    const id = Number(filter.id)
    if (!Number.isFinite(id)) return yearFiltered
    return yearFiltered.filter((row) => {
      if (filter.level === 'region') return row.region_id === id
      if (filter.level === 'province') return row.province_id === id
      if (filter.level === 'district') return row.district_id === id
      if (filter.level === 'subdistrict') return row.subdistrict_id === id
      if (filter.level === 'field') return row.land_id === id
      return true
    })
  }

  private sumForYears(rows: EmissionRow[], years: string[]): number {
    if (!years.length) return 0
    return rows
      .filter((row) => {
        const label = emissionRowYearLabel(row)
        return label != null && years.includes(label)
      })
      .reduce((sum, row) => sum + n(row.co2e), 0)
  }

  private baselineAverage(rows: EmissionRow[], meta: YearMeta): number {
    if (!meta.baselineYears.length) return 0
    return meta.baselineYears.reduce((sum, year) => sum + this.sumForYears(rows, [year]), 0) / meta.baselineYears.length
  }

  private uniqueArea(rows: EmissionRow[]): number {
    const areas = new Map<number, number>()
    rows.forEach((row) => {
      if (row.land_id) areas.set(row.land_id, n(row.land_area))
    })
    return Array.from(areas.values()).reduce((sum, area) => sum + area, 0)
  }

  private buildProcessEmissions(rows: EmissionRow[]) {
    const meta = this.getYearMeta(rows)
    const values = new Map<string, number>()
    rows.forEach((row) => {
      const year = emissionRowYearLabel(row)
      if (!year) return
      addToMap(values, `${year}|${labelOr(row.process, 'ไม่ระบุกระบวนการ')}`, n(row.co2e))
    })
    const processNames = Array.from(new Set(rows.map((row) => labelOr(row.process, 'ไม่ระบุกระบวนการ')))).sort()
    const result = meta.years.flatMap((year) =>
      processNames.map((process) => ({
        year,
        process,
        emission: round(values.get(`${year}|${process}`) ?? 0),
        isBaseline: year !== meta.currentYear,
      })),
    )
    if (meta.baselineYears.length) {
      result.unshift(
        ...processNames.map((process) => ({
          year: 'baseline_avg',
          process,
          emission: round(meta.baselineYears.reduce((sum, year) => sum + (values.get(`${year}|${process}`) ?? 0), 0) / meta.baselineYears.length),
          isBaseline: true,
        })),
      )
    }
    return result
  }

  private buildProcessActivities(rows: EmissionRow[]): ProcessActivityBreakdown[] {
    const meta = this.getYearMeta(rows)
    const byYearProcessActivity = new Map<string, Map<string, number>>()
    const processNames = new Set<string>()

    rows.forEach((row) => {
      const year = emissionRowYearLabel(row)
      if (!year) return
      const process = labelOr(row.process, 'ไม่ระบุกระบวนการ')
      const activity = labelOr(row.activity, 'อื่นๆ')
      processNames.add(process)
      const key = `${year}|${process}`
      if (!byYearProcessActivity.has(key)) byYearProcessActivity.set(key, new Map<string, number>())
      addToMap(byYearProcessActivity.get(key)!, activity, n(row.co2e))
    })

    const result: ProcessActivityBreakdown[] = []
    const sortedProcesses = Array.from(processNames).sort()

    sortedProcesses.forEach((process) => {
      if (meta.baselineYears.length) {
        const avgActivities = new Map<string, number>()
        meta.baselineYears.forEach((year) => {
          const activityMap = byYearProcessActivity.get(`${year}|${process}`)
          activityMap?.forEach((value, activity) => addToMap(avgActivities, activity, value / meta.baselineYears.length))
        })
        const activities = mapToValues(avgActivities)
        result.push({
          year: 'baseline_avg',
          process,
          totalEmission: round(activities.reduce((sum, item) => sum + item.emission, 0)),
          activities,
        })
      }

      meta.years.forEach((year) => {
        const activities = mapToValues(byYearProcessActivity.get(`${year}|${process}`) ?? new Map<string, number>())
        result.push({
          year,
          process,
          totalEmission: round(activities.reduce((sum, item) => sum + item.emission, 0)),
          activities,
        })
      })
    })

    return result
  }

  private buildProcessInputs(rows: EmissionRow[]): ProcessInputComparison[] {
    const meta = this.getYearMeta(rows)
    const processNames = Array.from(new Set(rows.map((row) => labelOr(row.process, 'เนเธกเนเธฃเธฐเธเธธเธเธฃเธฐเธเธงเธเธเธฒเธฃ')))).sort()

    const sumInput = (process: string, years: string[], re: RegExp) => {
      if (!years.length) return 0
      const sum = rows
        .filter((row) => {
          const year = emissionRowYearLabel(row)
          return year != null && years.includes(year)
        })
        .filter((row) => labelOr(row.process, '') === process)
        .filter((row) => re.test(`${row.process ?? ''} ${row.activity ?? ''}`))
        .reduce((total, row) => total + n(row.input_amount), 0)
      return years.length > 1 ? sum / years.length : sum
    }

    return processNames.map((process) => ({
      process,
      baselineFertilizerKg: round(sumInput(process, meta.baselineYears, FERTILIZER_RE), 1),
      currentFertilizerKg: round(sumInput(process, meta.currentYear ? [meta.currentYear] : [], FERTILIZER_RE), 1),
      baselineFuelLiter: round(sumInput(process, meta.baselineYears, FUEL_RE), 1),
      currentFuelLiter: round(sumInput(process, meta.currentYear ? [meta.currentYear] : [], FUEL_RE), 1),
    }))
  }

  private buildSpatialNodes(rows: EmissionRow[], targetYear?: string): SpatialNode[] {
    const meta = this.getYearMeta(rows)
    const currentYear = targetYear ?? meta.currentYear
    const nodes = new Map<string, SpatialNode & {
      fieldSet: Set<number>
      farmerSet: Set<number>
      areaSet: Map<number, number>
      processMap: Map<string, number>
      calculationBreakdowns: CalculationBreakdown[]
      actualCreditTotal: number
      actualSocByLand: Map<number, number>
    }>()

    const ensureNode = (id: string, parentId: string | undefined, level: SpatialNode['level'], name: string, lat: number, lng: number, zoom: number) => {
      if (!nodes.has(id)) {
        nodes.set(id, {
          id,
          parentId,
          level,
          name,
          lat,
          lng,
          zoom,
          fields: 0,
          farmers: 0,
          areaRai: 0,
          baselineEmission: 0,
          currentEmission: 0,
          processBreakdown: [],
          childrenIds: [],
          fieldSet: new Set<number>(),
          farmerSet: new Set<number>(),
          areaSet: new Map<number, number>(),
          processMap: new Map<string, number>(),
          calculationBreakdowns: [],
          actualCreditTotal: 0,
          actualSocByLand: new Map<number, number>(),
        })
      }
      const node = nodes.get(id)!
      if (parentId && !node.parentId) node.parentId = parentId
      return node
    }

    const country = ensureNode('thailand', undefined, 'country', 'ประเทศไทย', 13.0, 101.0, 6)

    rows.forEach((row) => {
      const regionId = this.regionNodeId(row)
      const provinceId = `province-${keyPart(row.province_id)}`
      const districtId = `district-${keyPart(row.district_id)}`
      const subdistrictId = `subdistrict-${keyPart(row.subdistrict_id)}`
      const fieldId = `field-${keyPart(row.land_id)}`
      const lat = n(row.land_lat) || n(row.subdistrict_lat) || n(row.camp_lat) || 13
      const lng = n(row.land_lng) || n(row.subdistrict_lng) || n(row.camp_lng) || 101
      const chain = [
        ensureNode(regionId, country.id, 'region', this.regionNodeName(row), lat, lng, 7),
        ensureNode(provinceId, regionId, 'province', labelOr(row.province_name, 'ไม่ระบุจังหวัด'), lat, lng, 8),
        ensureNode(districtId, provinceId, 'district', labelOr(row.district_name, 'ไม่ระบุอำเภอ'), lat, lng, 10),
        ensureNode(subdistrictId, districtId, 'subdistrict', labelOr(row.subdistrict_name, 'ไม่ระบุตำบล'), lat, lng, 12),
        ensureNode(fieldId, subdistrictId, 'field', labelOr(row.land_name, row.land_code ?? 'ไม่ระบุแปลง'), lat, lng, 15),
      ]
      const allNodes = [country, ...chain]
      allNodes.forEach((node, index) => {
        const next = allNodes[index + 1]
        if (next && !node.childrenIds.includes(next.id)) node.childrenIds.push(next.id)
        if (row.land_id) node.fieldSet.add(row.land_id)
        if (row.farmer_id) node.farmerSet.add(row.farmer_id)
        if (row.land_id) node.areaSet.set(row.land_id, n(row.land_area))
        if (row.cal_status_id != null) node.calStatusId = Math.max(node.calStatusId ?? 0, row.cal_status_id)
        if (row.land_id && n(row.actual_soc) > 0) {
          node.actualSocByLand.set(row.land_id, Math.max(node.actualSocByLand.get(row.land_id) ?? 0, n(row.actual_soc)))
        }
        const co2e = n(row.co2e)
        const rowYear = emissionRowYearLabel(row)
        if (rowYear === currentYear) {
          node.currentEmission += co2e
          node.actualCreditTotal += n(row.credit_co2e)
          addToMap(node.processMap, labelOr(row.process, 'ไม่ระบุกระบวนการ'), co2e)
        } else if (rowYear && meta.baselineYears.includes(rowYear)) {
          node.baselineEmission += co2e / Math.max(meta.baselineYears.length, 1)
        }
        const breakdown = this.parseCalculationBreakdown(row.queue_info)
        if (breakdown && node.calculationBreakdowns.length < 12) node.calculationBreakdowns.push(breakdown)
      })

      const field = nodes.get(fieldId)
      if (field) {
        field.fieldCode = row.land_code ?? ''
        field.fieldName = labelOr(row.land_name, row.land_code ?? '')
        field.farmerName = row.farmer_name ?? ''
        field.phone = row.phone ?? ''
        field.province = row.province_name ?? ''
        field.district = row.district_name ?? ''
        field.subdistrict = row.subdistrict_name ?? ''
        field.soilType = ''
        field.irrigationType = ''
        field.chanots = []
      }
    })

    return Array.from(nodes.values()).map((node) => {
      const area = Array.from(node.areaSet.values()).reduce((sum, value) => sum + value, 0)
      const actualSoc = Array.from(node.actualSocByLand.values()).reduce((sum, value) => sum + value, 0)
      return {
        id: node.id,
        parentId: node.parentId,
        level: node.level,
        name: node.name,
        lat: node.lat,
        lng: node.lng,
        zoom: node.zoom,
        fields: node.fieldSet.size,
        farmers: node.farmerSet.size,
        areaRai: round(area),
        baselineEmission: round(node.baselineEmission),
        currentEmission: round(node.currentEmission),
        actualCredit: round(node.actualCreditTotal, 4),
        actualSoc: round(actualSoc, 4),
        calStatusId: node.calStatusId,
        processBreakdown: mapToValues(node.processMap),
        childrenIds: node.childrenIds,
        fieldCode: node.fieldCode,
        fieldName: node.fieldName,
        farmerName: node.farmerName,
        phone: node.phone,
        province: node.province,
        district: node.district,
        subdistrict: node.subdistrict,
        soilType: node.soilType,
        irrigationType: node.irrigationType,
        chanots: node.chanots,
        calculationBreakdowns: node.calculationBreakdowns,
      }
    })
  }
}
