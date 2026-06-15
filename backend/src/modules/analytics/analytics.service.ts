import { Prisma } from '@prisma/client'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

type FilterLevel = 'all' | 'region' | 'province' | 'district' | 'subdistrict' | 'field'

type EmissionRow = {
  year: number | null
  co2e: number | null
  queue_info: string | null
  input_amount: number | null
  area_work: number | null
  process: string | null
  activity: string | null
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
  years: number[]
  currentYear?: number
  baselineYears: number[]
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
  return 0
}

function round(value: number, digits = 2): number {
  return +value.toFixed(digits)
}

function keyPart(value: number | null | undefined): string {
  return value == null ? 'unknown' : String(value)
}

function yearLabel(year: number): string {
  return String(year)
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

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

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
    const statuses = await this.prisma.log_act_detail_calStatus.findMany({
      select: {
        log_act_detail_calStatus_id: true,
        log_act_detail_calStatus_name: true,
      },
      orderBy: { log_act_detail_calStatus_id: 'asc' },
    })

    const matchedIds = statuses
      .filter((status) => this.isCalculatedStatusName(this.normalizeCalStatusName(status.log_act_detail_calStatus_name)))
      .map((status) => status.log_act_detail_calStatus_id)

    return matchedIds.length > 0 ? matchedIds : [2]
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
    const currentRows = meta.currentYear ? rows.filter((row) => row.year === meta.currentYear) : []
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

    return {
      baselineAvgEmission: round(baselineAvgEmission),
      currentEmission: round(currentEmission),
      currentYear: meta.currentYear ? yearLabel(meta.currentYear) : '-',
      machineEmission: round(machineEmission),
      inputEmission: round(inputEmission),
      fertilizerAmountKg: round(fertilizerAmountKg, 1),
      fertilizerEmission: round(inputEmission),
      areaRai: round(totalArea),
      yieldTon: 0,
      co2ePerTon: totalArea ? round(currentEmission / totalArea, 3) : 0,
      farmers,
      fields,
      years: meta.years.map(yearLabel),
      baselineYears: meta.baselineYears.map(yearLabel),
    }
  }

  async getCfTrend(filter: ReportFilter = {}) {
    const rows = this.applyFilter(await this.getEmissionRows(), filter)
    const meta = this.getYearMeta(rows)
    return meta.years.map((year) => ({
      year: yearLabel(year),
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

  async getCfCaneTypes(_filter: ReportFilter = {}) {
    // API contract is ready; cane type needs a reliable source column before the frontend flag is enabled.
    return []
  }

  async getCfCamps() {
    const rows = await this.getEmissionRows()
    const camps = new Map<number, EmissionRow[]>()
    rows.forEach((row) => {
      const campId = this.presentationCampId(row)
      if (!camps.has(campId)) camps.set(campId, [])
      camps.get(campId)!.push(row)
    })

    return Array.from(camps.entries())
      .map(([campId, campRows]) => {
        const meta = this.getYearMeta(campRows)
        const currentYear = meta.currentYear ? yearLabel(meta.currentYear) : ''
        const currentRows = currentYear ? campRows.filter((row) => yearLabel(row.year ?? 0) === currentYear) : []
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

  async getCfCampFields(campId?: number) {
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

    return Array.from(byLand.entries()).map(([landId, landRows]) => {
      const node = this.buildSpatialNodes(landRows).find((item) => item.level === 'field')
      const first = landRows[0]
      const currentYear = this.getYearMeta(landRows).currentYear
      const activitiesLogged = Array.from(new Set(landRows.filter((row) => row.year === currentYear).map((row) => labelOr(row.activity, '-'))))

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
    const nodes = this.buildSpatialNodes(await this.getEmissionRows())
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

  async getCfReportSummary(filter: ReportFilter = {}) {
    const [kpi, trend, process, transport, spatialNodes] = await Promise.all([
      this.getCfKpi(filter),
      this.getCfTrend(filter),
      this.getCfProcess(filter),
      this.getCfTransport(filter),
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
      },
      kpi,
      trend,
      process,
      transport,
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
    const calculatedStatusIds = await this.getCalculatedStatusIds()
    return this.prisma.$queryRaw<EmissionRow[]>`
      SELECT
        EXTRACT(YEAR FROM ah."activities_header_startDate")::int AS year,
        CASE
          WHEN cpq."carbon_process_queue_resultValue" IS NULL THEN 0
          WHEN LOWER(COALESCE(ru.unit_initial, ru.unit_name, '')) LIKE '%kg%' THEN cpq."carbon_process_queue_resultValue"::numeric / 1000
          WHEN LOWER(COALESCE(ru.unit_initial, ru.unit_name, '')) LIKE '%กิโล%' THEN cpq."carbon_process_queue_resultValue"::numeric / 1000
          ELSE cpq."carbon_process_queue_resultValue"::numeric
        END AS co2e,
        cpq."carbon_process_queue_info" AS queue_info,
        COALESCE(
          ld."log_act_detail_volumeAll",
          ld."log_act_detail_quatity" * ld."log_act_detail_volumePerUnit",
          0
        ) AS input_amount,
        COALESCE(ld."log_act_detail_areawork", 0) AS area_work,
        COALESCE(ht."act_header_type_name_th", ht."act_header_type_name_en", 'ไม่ระบุกระบวนการ') AS process,
        COALESCE(hdt."act_header_detail_type_name_th", 'อื่นๆ') AS activity,
        l.land_id,
        l.land_code,
        l.name AS land_name,
        l.area_size AS land_area,
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
      LEFT JOIN activities_header_type ht ON ht.act_header_type_id = COALESCE(ld.act_header_type_id, ah.act_header_type_id)
      LEFT JOIN activities_header_detail_type hdt ON hdt.act_header_detail_type_id = ld.act_header_detail_type_id
      LEFT JOIN lands l ON l.land_id = ah.land_id
      LEFT JOIN lands_camps lc ON lc.land_camp_id = l.land_camp_id
      LEFT JOIN farmers f ON f.farmer_id = COALESCE(ah.farmer_id, l.farmer_id)
      LEFT JOIN subdistricts sd ON sd.subdistricts_id = l.subdistrict_code
      LEFT JOIN districts d ON d.districts_id = sd.district_code
      LEFT JOIN provinces p ON p.provinces_id = d.province_code
      LEFT JOIN geographies g ON g.geographies_id = p.geography_id
      WHERE COALESCE(cpq."log_act_detail_calStatus_id", ld."log_act_detail_calStatus_id") IN (${Prisma.join(calculatedStatusIds)})
        AND ah."activities_header_startDate" IS NOT NULL
    `
  }

  private getYearMeta(rows: EmissionRow[]): YearMeta {
    const years = Array.from(new Set(rows.map((row) => row.year).filter((year): year is number => typeof year === 'number'))).sort((a, b) => a - b)
    const currentYear = years[years.length - 1]
    return {
      years,
      currentYear,
      baselineYears: currentYear ? years.filter((year) => year !== currentYear) : [],
    }
  }

  private applyFilter(rows: EmissionRow[], filter: ReportFilter): EmissionRow[] {
    if (!filter.level || filter.level === 'all' || !filter.id) return rows
    if (filter.level === 'region' && (filter.id === 'dan-chang' || filter.id === 'isan')) {
      return rows.filter((row) => this.farmGroupForRow(row) === filter.id)
    }
    const id = Number(filter.id)
    if (!Number.isFinite(id)) return rows
    return rows.filter((row) => {
      if (filter.level === 'region') return row.region_id === id
      if (filter.level === 'province') return row.province_id === id
      if (filter.level === 'district') return row.district_id === id
      if (filter.level === 'subdistrict') return row.subdistrict_id === id
      if (filter.level === 'field') return row.land_id === id
      return true
    })
  }

  private sumForYears(rows: EmissionRow[], years: number[]): number {
    if (!years.length) return 0
    return rows.filter((row) => row.year != null && years.includes(row.year)).reduce((sum, row) => sum + n(row.co2e), 0)
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
      if (!row.year) return
      addToMap(values, `${row.year}|${labelOr(row.process, 'ไม่ระบุกระบวนการ')}`, n(row.co2e))
    })
    const processNames = Array.from(new Set(rows.map((row) => labelOr(row.process, 'ไม่ระบุกระบวนการ')))).sort()
    const result = meta.years.flatMap((year) =>
      processNames.map((process) => ({
        year: yearLabel(year),
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
      if (!row.year) return
      const process = labelOr(row.process, 'ไม่ระบุกระบวนการ')
      const activity = labelOr(row.activity, 'อื่นๆ')
      processNames.add(process)
      const key = `${row.year}|${process}`
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
          year: yearLabel(year),
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

    const sumInput = (process: string, years: number[], re: RegExp) => {
      if (!years.length) return 0
      const sum = rows
        .filter((row) => row.year != null && years.includes(row.year))
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

  private buildSpatialNodes(rows: EmissionRow[]): SpatialNode[] {
    const meta = this.getYearMeta(rows)
    const nodes = new Map<string, SpatialNode & { fieldSet: Set<number>; farmerSet: Set<number>; areaSet: Map<number, number>; processMap: Map<string, number>; calculationBreakdowns: CalculationBreakdown[] }>()

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
        const co2e = n(row.co2e)
        if (row.year === meta.currentYear) {
          node.currentEmission += co2e
          addToMap(node.processMap, labelOr(row.process, 'ไม่ระบุกระบวนการ'), co2e)
        } else if (row.year && meta.baselineYears.includes(row.year)) {
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
