import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

type SocPayload = {
  land_id?: unknown
  carbon_soc_idCode?: unknown
  carbon_soc_socSampleIT?: unknown
  unit_socSampleIT?: unknown
  carbon_soc_bdSampleIt?: unknown
  unit_socbdSampleIT?: unknown
  carbon_soc_depSampleIT?: unknown
  unit_depSampleIT?: unknown
  carbon_soc_socIT?: unknown
  unit_socIT?: unknown
  carbon_soc_numLandSample?: unknown
  carbon_soc_numSample?: unknown
  carbon_soc_yearBeginPro?: unknown
  carbon_soc_update_uid?: unknown
}

type SoilImprovementPayload = {
  land_id?: unknown
  carbon_soilImprovementPlant_idCode?: unknown
  carbon_soilImprovementPlant_mc?: unknown
  unit_mc?: unknown
  carbon_soilImprovementPlant_nc?: unknown
  unit_nc?: unknown
  carbon_soilImprovementPlant_fnFix?: unknown
  unit_fnFix?: unknown
  act_resourceOther_id?: unknown
  carbon_soilImprovementPlant_update_uid?: unknown
}

@Injectable()
export class CarbonSocService {
  constructor(private prisma: PrismaService) {}

  private socInclude = {
    lands: {
      select: {
        land_id: true,
        land_code: true,
        name: true,
        land_size: true,
        area_size: true,
        lands_camps: { select: { land_camp_name: true } },
      },
    },
    units_socSampleIT: { select: { unit_id: true, unit_name: true, unit_initial: true } },
    units_socbdSampleIT: { select: { unit_id: true, unit_name: true, unit_initial: true } },
    units_depSampleIT: { select: { unit_id: true, unit_name: true, unit_initial: true } },
    units_socIT: { select: { unit_id: true, unit_name: true, unit_initial: true } },
  }

  private soilImprovementInclude = {
    lands: {
      select: {
        land_id: true,
        land_code: true,
        name: true,
        land_size: true,
        area_size: true,
        lands_camps: { select: { land_camp_name: true } },
      },
    },
    activities_resourceOther: {
      select: {
        act_resourceOther_id: true,
        act_resourceOther_name: true,
        act_resourceOther_info: true,
      },
    },
    units_mc: { select: { unit_id: true, unit_name: true, unit_initial: true } },
    units_nc: { select: { unit_id: true, unit_name: true, unit_initial: true } },
    units_fnFix: { select: { unit_id: true, unit_name: true, unit_initial: true } },
  }

  private cleanData<T extends Record<string, unknown>>(data: T) {
    return Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined && value !== ''),
    )
  }

  private toOptionalNumber(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined
    const num = Number(value)
    return Number.isFinite(num) ? num : undefined
  }

  private toOptionalInt(value: unknown) {
    const num = this.toOptionalNumber(value)
    return num !== undefined && Number.isInteger(num) ? num : undefined
  }

  private toOptionalText(value: unknown) {
    if (value === undefined || value === null) return undefined
    const text = String(value).trim()
    return text ? text : undefined
  }

  private toFiniteNumber(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined
    const num = Number(value)
    return Number.isFinite(num) ? num : undefined
  }

  private round(value: number, digits = 4) {
    const factor = 10 ** digits
    return Math.round(value * factor) / factor
  }

  private normalizeUnitText(value?: string | null) {
    return String(value ?? '')
      .toLowerCase()
      .replace(/co₂/g, 'co2')
      .replace(/[^a-z0-9ก-๙]+/g, '')
      .trim()
  }

  private async nextSocId(tx: any) {
    const current = await tx.carbon_soc.aggregate({ _max: { carbon_soc_id: true } })
    return (current._max.carbon_soc_id ?? 0) + 1
  }

  private async nextSoilImprovementPlantId(tx: any) {
    const current = await tx.carbon_soilImprovementPlants.aggregate({
      _max: { carbon_soilImprovementPlant_id: true },
    })
    return (current._max.carbon_soilImprovementPlant_id ?? 0) + 1
  }

  private normalizeSocPayload(data: SocPayload) {
    return this.cleanData({
      land_id: this.toOptionalInt(data.land_id),
      carbon_soc_idCode: this.toOptionalText(data.carbon_soc_idCode),
      carbon_soc_socSampleIT: this.toOptionalNumber(data.carbon_soc_socSampleIT),
      unit_socSampleIT: this.toOptionalInt(data.unit_socSampleIT),
      carbon_soc_bdSampleIt: this.toOptionalNumber(data.carbon_soc_bdSampleIt),
      unit_socbdSampleIT: this.toOptionalInt(data.unit_socbdSampleIT),
      carbon_soc_depSampleIT: this.toOptionalNumber(data.carbon_soc_depSampleIT),
      unit_depSampleIT: this.toOptionalInt(data.unit_depSampleIT),
      carbon_soc_socIT: this.toOptionalNumber(data.carbon_soc_socIT),
      unit_socIT: this.toOptionalInt(data.unit_socIT),
      carbon_soc_numLandSample: this.toOptionalInt(data.carbon_soc_numLandSample),
      carbon_soc_numSample: this.toOptionalInt(data.carbon_soc_numSample),
      carbon_soc_yearBeginPro: this.toOptionalText(data.carbon_soc_yearBeginPro),
      carbon_soc_update_uid: this.toOptionalInt(data.carbon_soc_update_uid),
    })
  }

  private normalizeSoilImprovementPayload(data: SoilImprovementPayload) {
    return this.cleanData({
      land_id: this.toOptionalInt(data.land_id),
      carbon_soilImprovementPlant_idCode: this.toOptionalText(data.carbon_soilImprovementPlant_idCode),
      carbon_soilImprovementPlant_mc: this.toOptionalNumber(data.carbon_soilImprovementPlant_mc),
      unit_mc: this.toOptionalInt(data.unit_mc),
      carbon_soilImprovementPlant_nc: this.toOptionalNumber(data.carbon_soilImprovementPlant_nc),
      unit_nc: this.toOptionalInt(data.unit_nc),
      carbon_soilImprovementPlant_fnFix: this.toOptionalNumber(data.carbon_soilImprovementPlant_fnFix),
      unit_fnFix: this.toOptionalInt(data.unit_fnFix),
      act_resourceOther_id: this.toOptionalInt(data.act_resourceOther_id),
      carbon_soilImprovementPlant_update_uid: this.toOptionalInt(data.carbon_soilImprovementPlant_update_uid),
    })
  }

  private landAreaRai(land?: { land_size?: number | null; area_size?: number | null } | null) {
    const landSize = this.toFiniteNumber(land?.land_size)
    if (landSize !== undefined && landSize > 0) return landSize

    const areaSize = this.toFiniteNumber(land?.area_size)
    if (areaSize !== undefined && areaSize > 0) return areaSize

    return undefined
  }

  private assertPositive(value: unknown, label: string) {
    const num = this.toFiniteNumber(value)
    if (num === undefined || num <= 0) {
      throw new BadRequestException(`กรุณาระบุ${label}เป็นตัวเลขมากกว่า 0`)
    }
    return num
  }

  private async resolveResultUnitId(kind: 'tCO2e' | 'tN') {
    const units = await this.prisma.units.findMany({
      select: { unit_id: true, unit_name: true, unit_initial: true },
      orderBy: { unit_id: 'asc' },
    })

    const candidates = kind === 'tCO2e'
      ? ['tco2e', 'tonco2e', 'tonneco2e', 'ตันco2e']
      : ['tn', 'tonn', 'tonnen', 'ตันn']

    const matched = units.find((unit) => {
      const tokens = [
        this.normalizeUnitText(unit.unit_initial),
        this.normalizeUnitText(unit.unit_name),
      ]
      return tokens.some((token) => candidates.includes(token))
    })

    if (!matched) {
      throw new BadRequestException(`ไม่พบหน่วยผลลัพธ์ ${kind} ในตาราง units กรุณาเลือกหน่วยผลลัพธ์ก่อนคำนวณ`)
    }

    return matched.unit_id
  }

  private withSocDerived(row: any) {
    const areaRai = this.landAreaRai(row.lands)
    const socTco2eTotal = this.toFiniteNumber(row.carbon_soc_socIT)

    return {
      ...row,
      derived: {
        areaRai: areaRai ?? null,
        socTco2eTotal: socTco2eTotal ?? null,
        socTco2ePerRai: areaRai && socTco2eTotal !== undefined ? this.round(socTco2eTotal / areaRai, 4) : null,
      },
    }
  }

  private withSoilImprovementDerived(row: any) {
    const areaRai = this.landAreaRai(row.lands)
    const fnfixTnTotal = this.toFiniteNumber(row.carbon_soilImprovementPlant_fnFix)

    return {
      ...row,
      derived: {
        areaRai: areaRai ?? null,
        fnfixTnTotal: fnfixTnTotal ?? null,
        fnfixTnPerRai: areaRai && fnfixTnTotal !== undefined ? this.round(fnfixTnTotal / areaRai, 6) : null,
      },
    }
  }

  private isSocInputMissing(row: any) {
    const areaRai = this.landAreaRai(row.lands)
    return !areaRai
      || !this.toFiniteNumber(row.land_id)
      || !this.toFiniteNumber(row.carbon_soc_socSampleIT)
      || !this.toFiniteNumber(row.carbon_soc_bdSampleIt)
      || !this.toFiniteNumber(row.carbon_soc_depSampleIT)
  }

  private isSoilImprovementInputMissing(row: any) {
    const areaRai = this.landAreaRai(row.lands)
    return !areaRai
      || !this.toFiniteNumber(row.land_id)
      || !this.toFiniteNumber(row.carbon_soilImprovementPlant_mc)
      || !this.toFiniteNumber(row.carbon_soilImprovementPlant_nc)
  }

  async getSocMeasurements() {
    const rows = await this.prisma.carbon_soc.findMany({
      include: this.socInclude,
      orderBy: [
        { carbon_soc_update_at: 'desc' },
        { carbon_soc_id: 'desc' },
      ],
    })

    return rows.map((row) => this.withSocDerived(row))
  }

  async createSocMeasurement(data: SocPayload) {
    const normalized = this.normalizeSocPayload(data)
    const now = new Date()

    const row = await this.prisma.$transaction(async (tx) => tx.carbon_soc.create({
      data: {
        carbon_soc_id: await this.nextSocId(tx),
        ...normalized,
        carbon_soc_create_at: now,
        carbon_soc_update_at: now,
      },
      include: this.socInclude,
    }))

    return this.withSocDerived(row)
  }

  async updateSocMeasurement(id: number, data: SocPayload) {
    const normalized = this.normalizeSocPayload(data)

    const row = await this.prisma.carbon_soc.update({
      where: { carbon_soc_id: id },
      data: {
        ...normalized,
        carbon_soc_update_at: new Date(),
      },
      include: this.socInclude,
    })

    return this.withSocDerived(row)
  }

  async deleteSocMeasurement(id: number) {
    return this.prisma.carbon_soc.delete({ where: { carbon_soc_id: id } })
  }

  async calculateSocMeasurement(id: number) {
    const row = await this.prisma.carbon_soc.findUnique({
      where: { carbon_soc_id: id },
      include: this.socInclude,
    })

    if (!row) throw new NotFoundException(`carbon_soc ${id} not found`)
    if (!row.land_id || !row.lands) throw new BadRequestException('กรุณาเลือกแปลงก่อนคำนวณ SOC')

    const areaRai = this.landAreaRai(row.lands)
    if (!areaRai) throw new BadRequestException('แปลงนี้ยังไม่มีพื้นที่ land_size หรือ area_size สำหรับคำนวณ SOC')

    const socPercent = this.assertPositive(row.carbon_soc_socSampleIT, 'ค่า SOC sample')
    const bulkDensity = this.assertPositive(row.carbon_soc_bdSampleIt, 'ค่า bulk density')
    const depthCm = this.assertPositive(row.carbon_soc_depSampleIT, 'ค่าความลึกดิน')
    const resultUnitId = row.unit_socIT ?? await this.resolveResultUnitId('tCO2e')

    const socTcPerRai = socPercent * bulkDensity * depthCm * 0.16
    const socTco2ePerRai = socTcPerRai * (44 / 12)
    const socTco2eTotal = socTco2ePerRai * areaRai

    const updated = await this.prisma.carbon_soc.update({
      where: { carbon_soc_id: id },
      data: {
        carbon_soc_socIT: this.round(socTco2eTotal, 4),
        unit_socIT: resultUnitId,
        carbon_soc_update_at: new Date(),
      },
      include: this.socInclude,
    })

    return this.withSocDerived(updated)
  }

  async getSoilImprovementPlants() {
    const rows = await this.prisma.carbon_soilImprovementPlants.findMany({
      include: this.soilImprovementInclude,
      orderBy: [
        { carbon_soilImprovementPlant_update_at: 'desc' },
        { carbon_soilImprovementPlant_id: 'desc' },
      ],
    })

    return rows.map((row) => this.withSoilImprovementDerived(row))
  }

  async createSoilImprovementPlant(data: SoilImprovementPayload) {
    const normalized = this.normalizeSoilImprovementPayload(data)
    const now = new Date()

    const row = await this.prisma.$transaction(async (tx) => tx.carbon_soilImprovementPlants.create({
      data: {
        carbon_soilImprovementPlant_id: await this.nextSoilImprovementPlantId(tx),
        ...normalized,
        carbon_soilImprovementPlant_create_at: now,
        carbon_soilImprovementPlant_update_at: now,
      },
      include: this.soilImprovementInclude,
    }))

    return this.withSoilImprovementDerived(row)
  }

  async updateSoilImprovementPlant(id: number, data: SoilImprovementPayload) {
    const normalized = this.normalizeSoilImprovementPayload(data)

    const row = await this.prisma.carbon_soilImprovementPlants.update({
      where: { carbon_soilImprovementPlant_id: id },
      data: {
        ...normalized,
        carbon_soilImprovementPlant_update_at: new Date(),
      },
      include: this.soilImprovementInclude,
    })

    return this.withSoilImprovementDerived(row)
  }

  async deleteSoilImprovementPlant(id: number) {
    return this.prisma.carbon_soilImprovementPlants.delete({
      where: { carbon_soilImprovementPlant_id: id },
    })
  }

  async calculateSoilImprovementPlant(id: number) {
    const row = await this.prisma.carbon_soilImprovementPlants.findUnique({
      where: { carbon_soilImprovementPlant_id: id },
      include: this.soilImprovementInclude,
    })

    if (!row) throw new NotFoundException(`carbon_soilImprovementPlant ${id} not found`)
    if (!row.land_id || !row.lands) throw new BadRequestException('กรุณาเลือกแปลงก่อนคำนวณ Fnfix')

    const areaRai = this.landAreaRai(row.lands)
    if (!areaRai) throw new BadRequestException('แปลงนี้ยังไม่มีพื้นที่ land_size หรือ area_size สำหรับคำนวณ Fnfix')

    const dryMatterKgPerRai = this.assertPositive(row.carbon_soilImprovementPlant_mc, 'ค่า dry matter / mc')
    const nitrogenPercent = this.assertPositive(row.carbon_soilImprovementPlant_nc, 'ค่า N content / nc')
    const resultUnitId = row.unit_fnFix ?? await this.resolveResultUnitId('tN')
    const fnfixTn = areaRai * (dryMatterKgPerRai / 1000) * (nitrogenPercent / 100)

    const updated = await this.prisma.carbon_soilImprovementPlants.update({
      where: { carbon_soilImprovementPlant_id: id },
      data: {
        carbon_soilImprovementPlant_fnFix: this.round(fnfixTn, 4),
        unit_fnFix: resultUnitId,
        carbon_soilImprovementPlant_update_at: new Date(),
      },
      include: this.soilImprovementInclude,
    })

    return this.withSoilImprovementDerived(updated)
  }

  async getSummary() {
    const [socRows, soilImprovementRows] = await Promise.all([
      this.prisma.carbon_soc.findMany({ include: this.socInclude }),
      this.prisma.carbon_soilImprovementPlants.findMany({ include: this.soilImprovementInclude }),
    ])

    const socTotalTco2e = socRows.reduce((sum, row) => sum + (this.toFiniteNumber(row.carbon_soc_socIT) ?? 0), 0)
    const fnfixTotalTn = soilImprovementRows.reduce(
      (sum, row) => sum + (this.toFiniteNumber(row.carbon_soilImprovementPlant_fnFix) ?? 0),
      0,
    )
    const landIds = new Set<number>()
    for (const row of socRows) if (row.land_id) landIds.add(row.land_id)
    for (const row of soilImprovementRows) if (row.land_id) landIds.add(row.land_id)

    return {
      socTotalTco2e: this.round(socTotalTco2e, 4),
      fnfixTotalTn: this.round(fnfixTotalTn, 4),
      landCount: landIds.size,
      missingInputCount: [
        ...socRows.filter((row) => this.isSocInputMissing(row)),
        ...soilImprovementRows.filter((row) => this.isSoilImprovementInputMissing(row)),
      ].length,
      socMeasurementCount: socRows.length,
      soilImprovementPlantCount: soilImprovementRows.length,
    }
  }
}
