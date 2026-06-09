import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

type CoefficientPayload = {
  coef_em_factor_idCode?: string | null
  carbonfootprint_type_id?: number | string | null
  group_emission_factor_id?: number | string | null
  coef_em_factor_name?: string | null
  coef_em_factor_info?: string | null
  unit_prefix_id?: number | string | null
  unit_id?: number | string | null
  coef_em_factor_value_co2?: number | string | null
  unit_prefix_id_co2?: number | string | null
  unit_id_co2?: number | string | null
  coef_em_factor_value_ch4foss?: number | string | null
  unit_prefix_id_ch4foss?: number | string | null
  unit_id_ch4foss?: number | string | null
  coef_em_factor_value_ch4?: number | string | null
  unit_prefix_id_ch4?: number | string | null
  unit_id_ch4?: number | string | null
  coef_em_factor_value_n2o?: number | string | null
  unit_prefix_id_n2o?: number | string | null
  unit_id_n2o?: number | string | null
  coef_em_factor_value_total?: number | string | null
  unit_prefix_id_total?: number | string | null
  unit_id_total?: number | string | null
  coef_em_factor_ref?: number | string | null
  coef_em_factor_updatePostDateRef?: Date | string | null
  update_uid?: number | string | null
}

type GwpPayload = {
  coef_em_factor_gwp_name?: string | null
  coef_em_factor_gwp_name_en?: string | null
  coef_em_factor_gwp_value?: number | string | null
  coef_em_factor_gwp_info?: string | null
  coef_em_factor_gwp_update_uid?: number | string | null
  coef_em_factor_gwp_ref?: number | string | null
}

type CfTypePayload = {
  cf_type_name_short?: string | null
  cf_type_name_th?: string | null
  cf_type_name_en?: string | null
}

type GroupPayload = {
  group_emission_factor_idCode?: string | null
  group_emission_factor_name_short?: string | null
  group_emission_factor_name?: string | null
  group_emission_factor_info?: string | null
  carbonfootprint_type_id?: number | string | null
}

type UnitPayload = {
  unit_name?: string | null
  unit_initial?: string | null
  unit_updated_uid?: number | string | null
}

type PrefixPayload = {
  unit_prefix_name?: string | null
  unit_prefix_initial?: string | null
  unit_prefix_updated_uid?: number | string | null
  unit_prefix_value?: number | string | null
}

@Injectable()
export class EmissionFactorsService {
  constructor(private prisma: PrismaService) {}

  private toOptionalNumber(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined
    const num = Number(value)
    if (Number.isNaN(num)) {
      throw new BadRequestException(`Invalid number: ${String(value)}`)
    }
    return num
  }

  private toOptionalDate(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined
    const date = value instanceof Date ? value : new Date(String(value))
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid date: ${String(value)}`)
    }
    return date
  }

  private toOptionalText(value: unknown) {
    if (value === undefined || value === null) return undefined
    const text = String(value).trim()
    return text === '' ? undefined : text
  }

  private toRequiredText(value: unknown, fieldName: string) {
    const text = this.toOptionalText(value)
    if (!text) {
      throw new BadRequestException(`${fieldName} is required`)
    }
    return text
  }

  private cleanData<T extends Record<string, unknown>>(data: T) {
    return Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    )
  }

  private normalizeCoefficientPayload(data: CoefficientPayload) {
    return {
      coef_em_factor_idCode: this.toOptionalText(data.coef_em_factor_idCode),
      carbonfootprint_type_id: this.toOptionalNumber(data.carbonfootprint_type_id),
      group_emission_factor_id: this.toOptionalNumber(data.group_emission_factor_id),
      coef_em_factor_name: this.toRequiredText(data.coef_em_factor_name, 'coef_em_factor_name'),
      coef_em_factor_info: this.toOptionalText(data.coef_em_factor_info),
      unit_prefix_id: this.toOptionalNumber(data.unit_prefix_id),
      unit_id: this.toOptionalNumber(data.unit_id),
      coef_em_factor_value_co2: this.toOptionalNumber(data.coef_em_factor_value_co2),
      unit_prefix_id_co2: this.toOptionalNumber(data.unit_prefix_id_co2),
      unit_id_co2: this.toOptionalNumber(data.unit_id_co2),
      coef_em_factor_value_ch4foss: this.toOptionalNumber(data.coef_em_factor_value_ch4foss),
      unit_prefix_id_ch4foss: this.toOptionalNumber(data.unit_prefix_id_ch4foss),
      unit_id_ch4foss: this.toOptionalNumber(data.unit_id_ch4foss),
      coef_em_factor_value_ch4: this.toOptionalNumber(data.coef_em_factor_value_ch4),
      unit_prefix_id_ch4: this.toOptionalNumber(data.unit_prefix_id_ch4),
      unit_id_ch4: this.toOptionalNumber(data.unit_id_ch4),
      coef_em_factor_value_n2o: this.toOptionalNumber(data.coef_em_factor_value_n2o),
      unit_prefix_id_n2o: this.toOptionalNumber(data.unit_prefix_id_n2o),
      unit_id_n2o: this.toOptionalNumber(data.unit_id_n2o),
      coef_em_factor_value_total: this.toOptionalNumber(data.coef_em_factor_value_total),
      unit_prefix_id_total: this.toOptionalNumber(data.unit_prefix_id_total),
      unit_id_total: this.toOptionalNumber(data.unit_id_total),
      coef_em_factor_ref: this.toOptionalNumber(data.coef_em_factor_ref),
      coef_em_factor_updatePostDateRef: this.toOptionalDate(data.coef_em_factor_updatePostDateRef),
      update_uid: this.toOptionalNumber(data.update_uid),
    }
  }

  private normalizeGwpPayload(data: GwpPayload) {
    return {
      coef_em_factor_gwp_name: this.toRequiredText(data.coef_em_factor_gwp_name, 'coef_em_factor_gwp_name'),
      coef_em_factor_gwp_name_en: this.toOptionalText(data.coef_em_factor_gwp_name_en),
      coef_em_factor_gwp_value: this.toOptionalNumber(data.coef_em_factor_gwp_value),
      coef_em_factor_gwp_info: this.toOptionalText(data.coef_em_factor_gwp_info),
      coef_em_factor_gwp_update_uid: this.toOptionalNumber(data.coef_em_factor_gwp_update_uid),
      coef_em_factor_gwp_ref: this.toOptionalNumber(data.coef_em_factor_gwp_ref),
    }
  }

  private normalizeCfTypePayload(data: CfTypePayload) {
    return {
      cf_type_name_short: this.toOptionalText(data.cf_type_name_short),
      cf_type_name_th: this.toRequiredText(data.cf_type_name_th, 'cf_type_name_th'),
      cf_type_name_en: this.toOptionalText(data.cf_type_name_en),
    }
  }

  private normalizeGroupPayload(data: GroupPayload) {
    return {
      group_emission_factor_idCode: this.toOptionalText(data.group_emission_factor_idCode),
      group_emission_factor_name_short: this.toOptionalText(data.group_emission_factor_name_short),
      group_emission_factor_name: this.toRequiredText(data.group_emission_factor_name, 'group_emission_factor_name'),
      group_emission_factor_info: this.toOptionalText(data.group_emission_factor_info),
      carbonfootprint_type_id: this.toOptionalNumber(data.carbonfootprint_type_id),
    }
  }

  private normalizeUnitPayload(data: UnitPayload) {
    return {
      unit_name: this.toRequiredText(data.unit_name, 'unit_name'),
      unit_initial: this.toOptionalText(data.unit_initial),
      unit_updated_uid: this.toOptionalNumber(data.unit_updated_uid),
    }
  }

  private normalizePrefixPayload(data: PrefixPayload) {
    return {
      unit_prefix_name: this.toRequiredText(data.unit_prefix_name, 'unit_prefix_name'),
      unit_prefix_initial: this.toOptionalText(data.unit_prefix_initial),
      unit_prefix_updated_uid: this.toOptionalNumber(data.unit_prefix_updated_uid),
      unit_prefix_value: this.toOptionalNumber(data.unit_prefix_value),
    }
  }

  // EF coefficients
  getCoefficients(groupId?: number, cfTypeId?: number) {
    return this.prisma.coefficients_emissions_factors.findMany({
      where: {
        ...(groupId ? { group_emission_factor_id: groupId } : {}),
        ...(cfTypeId ? { carbonfootprint_type_id: cfTypeId } : {}),
      },
      orderBy: { coefficient_emission_factor_id: 'asc' },
    })
  }

  async createCoefficient(data: CoefficientPayload) {
    const normalized = this.normalizeCoefficientPayload(data)
    const now = new Date()

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.coefficients_emissions_factors.aggregate({
        _max: { coefficient_emission_factor_id: true },
      })

      return tx.coefficients_emissions_factors.create({
        data: {
          coefficient_emission_factor_id: (last._max.coefficient_emission_factor_id ?? 0) + 1,
          ...this.cleanData(normalized),
          create_at: now,
          update_at: now,
        },
      })
    })
  }

  updateCoefficient(id: number, data: CoefficientPayload) {
    const normalized = this.normalizeCoefficientPayload(data)
    return this.prisma.coefficients_emissions_factors.update({
      where: { coefficient_emission_factor_id: id },
      data: {
        ...this.cleanData(normalized),
        update_at: new Date(),
      },
    })
  }

  deleteCoefficient(id: number) {
    return this.prisma.coefficients_emissions_factors.delete({
      where: { coefficient_emission_factor_id: id },
    })
  }

  // GWP
  getGwp() {
    return this.prisma.coefficients_emissions_factors_gwp.findMany({
      orderBy: { coefficients_emissions_factors_gwp_id: 'asc' },
    })
  }

  async createGwp(data: GwpPayload) {
    const normalized = this.normalizeGwpPayload(data)
    const now = new Date()

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.coefficients_emissions_factors_gwp.aggregate({
        _max: { coefficients_emissions_factors_gwp_id: true },
      })

      return tx.coefficients_emissions_factors_gwp.create({
        data: {
          coefficients_emissions_factors_gwp_id:
            (last._max.coefficients_emissions_factors_gwp_id ?? 0) + 1,
          ...this.cleanData(normalized),
          coef_em_factor_gwp_create_at: now,
          coef_em_factor_gwp_update_at: now,
        },
      })
    })
  }

  updateGwp(id: number, data: GwpPayload) {
    const normalized = this.normalizeGwpPayload(data)
    return this.prisma.coefficients_emissions_factors_gwp.update({
      where: { coefficients_emissions_factors_gwp_id: id },
      data: {
        ...this.cleanData(normalized),
        coef_em_factor_gwp_update_at: new Date(),
      },
    })
  }

  deleteGwp(id: number) {
    return this.prisma.coefficients_emissions_factors_gwp.delete({
      where: { coefficients_emissions_factors_gwp_id: id },
    })
  }

  // CF types
  getCfTypes() {
    return this.prisma.carbonfootprints_types.findMany({
      orderBy: { carbonfootprint_type_id: 'asc' },
    })
  }

  async createCfType(data: CfTypePayload) {
    const normalized = this.normalizeCfTypePayload(data)
    const now = new Date()

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.carbonfootprints_types.aggregate({
        _max: { carbonfootprint_type_id: true },
      })

      return tx.carbonfootprints_types.create({
        data: {
          carbonfootprint_type_id: (last._max.carbonfootprint_type_id ?? 0) + 1,
          ...this.cleanData(normalized),
          cf_type_create_at: now,
          cf_type_update_at: now,
        },
      })
    })
  }

  updateCfType(id: number, data: CfTypePayload) {
    const normalized = this.normalizeCfTypePayload(data)
    return this.prisma.carbonfootprints_types.update({
      where: { carbonfootprint_type_id: id },
      data: {
        ...this.cleanData(normalized),
        cf_type_update_at: new Date(),
      },
    })
  }

  deleteCfType(id: number) {
    return this.prisma.carbonfootprints_types.delete({
      where: { carbonfootprint_type_id: id },
    })
  }

  // Groups
  getGroups(cfTypeId?: number) {
    return this.prisma.groups_emissions_factors.findMany({
      where: cfTypeId ? { carbonfootprint_type_id: cfTypeId } : undefined,
      orderBy: { group_emission_factor_id: 'asc' },
    })
  }

  async createGroup(data: GroupPayload) {
    const normalized = this.normalizeGroupPayload(data)

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.groups_emissions_factors.aggregate({
        _max: { group_emission_factor_id: true },
      })

      return tx.groups_emissions_factors.create({
        data: {
          group_emission_factor_id: (last._max.group_emission_factor_id ?? 0) + 1,
          ...this.cleanData(normalized),
        },
      })
    })
  }

  updateGroup(id: number, data: GroupPayload) {
    const normalized = this.normalizeGroupPayload(data)
    return this.prisma.groups_emissions_factors.update({
      where: { group_emission_factor_id: id },
      data: this.cleanData(normalized),
    })
  }

  deleteGroup(id: number) {
    return this.prisma.groups_emissions_factors.delete({
      where: { group_emission_factor_id: id },
    })
  }

  // Units
  getUnits() {
    return this.prisma.units.findMany({
      orderBy: { unit_id: 'asc' },
    })
  }

  async createUnit(data: UnitPayload) {
    const normalized = this.normalizeUnitPayload(data)

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.units.aggregate({ _max: { unit_id: true } })

      return tx.units.create({
        data: {
          unit_id: (last._max.unit_id ?? 0) + 1,
          ...this.cleanData(normalized),
          unit_updated_at: new Date(),
        },
      })
    })
  }

  updateUnit(id: number, data: UnitPayload) {
    const normalized = this.normalizeUnitPayload(data)
    return this.prisma.units.update({
      where: { unit_id: id },
      data: {
        ...this.cleanData(normalized),
        unit_updated_at: new Date(),
      },
    })
  }

  deleteUnit(id: number) {
    return this.prisma.units.delete({
      where: { unit_id: id },
    })
  }

  // Unit prefixes
  getUnitPrefixs() {
    return this.prisma.units_prefixs.findMany({
      orderBy: { unit_prefix_id: 'asc' },
    })
  }

  async createUnitPrefix(data: PrefixPayload) {
    const normalized = this.normalizePrefixPayload(data)

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.units_prefixs.aggregate({ _max: { unit_prefix_id: true } })

      return tx.units_prefixs.create({
        data: {
          unit_prefix_id: (last._max.unit_prefix_id ?? 0) + 1,
          ...this.cleanData(normalized),
          unit_prefix_updated_at: new Date(),
        },
      })
    })
  }

  updateUnitPrefix(id: number, data: PrefixPayload) {
    const normalized = this.normalizePrefixPayload(data)
    return this.prisma.units_prefixs.update({
      where: { unit_prefix_id: id },
      data: {
        ...this.cleanData(normalized),
        unit_prefix_updated_at: new Date(),
      },
    })
  }

  deleteUnitPrefix(id: number) {
    return this.prisma.units_prefixs.delete({
      where: { unit_prefix_id: id },
    })
  }
}
