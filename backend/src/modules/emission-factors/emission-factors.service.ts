import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { last } from 'rxjs'

@Injectable()
export class EmissionFactorsService {
  constructor(private prisma: PrismaService) {}

  // EF coefficients
  getCoefficients(groupId?: number, cfTypeId?: number) {
    return this.prisma.coefficients_emissions_factors.findMany({
      where: {
        ...(groupId  ? { group_emission_factor_id: groupId }  : {}),
        ...(cfTypeId ? { carbonfootprint_type_id:  cfTypeId } : {}),
      },
      orderBy: { coefficient_emission_factor_id: 'asc' },
    })
  }

  createCoefficient(data: Record<string, unknown>) {
    return this.prisma.coefficients_emissions_factors.create({ data: { ...data, create_at: new Date(), update_at: new Date() } as any })
  }

  updateCoefficient(id: number, data: Record<string, unknown>) {
    return this.prisma.coefficients_emissions_factors.update({
      where: { coefficient_emission_factor_id: id },
      data: { ...data, update_at: new Date() } as any,
    })
  }

  deleteCoefficient(id: number) {
    return this.prisma.coefficients_emissions_factors.delete({ where: { coefficient_emission_factor_id: id } })
  }

  // GWP
  getGwp() { return this.prisma.coefficients_emissions_factors_gwp.findMany({ orderBy: { coefficients_emissions_factors_gwp_id: 'asc' } }) }
  createGwp(data: Record<string, unknown>) { return this.prisma.coefficients_emissions_factors_gwp.create({ data: { ...data, coef_em_factor_gwp_create_at: new Date() } as any }) }
  updateGwp(id: number, data: Record<string, unknown>) {
    return this.prisma.coefficients_emissions_factors_gwp.update({
      where: { coefficients_emissions_factors_gwp_id: id },
      data: { ...data, coef_em_factor_gwp_update_at: new Date() } as any,
    })
  }

  // CF Types
  getCfTypes()                  { return this.prisma.carbonfootprints_types.findMany({ orderBy: { carbonfootprint_type_id: 'asc' } }) }
  createCfType(data: any)       { return this.prisma.carbonfootprints_types.create({ data: { ...data, cf_type_create_at: new Date(), cf_type_update_at: new Date() } }) }
  updateCfType(id: number, d: any) { return this.prisma.carbonfootprints_types.update({ where: { carbonfootprint_type_id: id }, data: { ...d, cf_type_update_at: new Date() } }) }

  // Groups
  getGroups(cfTypeId?: number) {
    return this.prisma.groups_emissions_factors.findMany({
      where: cfTypeId ? { carbonfootprint_type_id: cfTypeId } : undefined,
      orderBy: { group_emission_factor_id: 'asc' },
    })
  }
  createGroup(data: any) { return this.prisma.groups_emissions_factors.create({ data }) }
  updateGroup(id: number, data: any) { return this.prisma.groups_emissions_factors.update({ where: { group_emission_factor_id: id }, data }) }

  // Units
  getUnits() { 
    return this.prisma.units.findMany({ 
      select: { 
        unit_id: true, unit_name: true, unit_initial: true 
      },
      orderBy: { unit_id: 'asc' } 
    }) 
  }

  async createUnit(d: any) {
    return this.prisma.$transaction(async (tx) => {
      const last = await tx.units.aggregate({ _max: { unit_id: true } })
      return tx.units.create({
        data: {
          unit_id: (last._max.unit_id ?? 0) +1,
          unit_name:    d.unit_name?.trim(),
          unit_initial: d.unit_initial?.trim() || null,
          unit_updated_at: new Date(),
        },
      })
    })
  }

  updateUnit(id: number, d: any) {
    return this.prisma.units.update({
      where: { unit_id: id },
      data: {
        unit_name:    d.unit_name    ?? undefined,
        unit_initial: d.unit_initial ?? undefined,
        unit_updated_at: new Date(),
      },
    })
  }

  deleteUnit(id: number) { return this.prisma.units.delete({ where: { unit_id: id } }) }

  // Unit prefixes
  getUnitPrefixs() { 
    return this.prisma.units_prefixs.findMany({ 
      select: {
        unit_prefix_id: true, unit_prefix_name: true,
        unit_prefix_initial: true, unit_prefix_value: true,
      },
      orderBy: { 
        unit_prefix_id: 'asc' 
      } 
    }) 
  }

  async createUnitPrefix(d: any) {
    return this.prisma.$transaction(async (tx) => {
      const last = await tx.units_prefixs.aggregate({ _max: { unit_prefix_id: true } })
      return tx.units_prefixs.create({
        data: {
          unit_prefix_id: (last._max.unit_prefix_id ?? 0) + 1,
          unit_prefix_name:    d.unit_prefix_name.trim(),
          unit_prefix_initial: d.unit_prefix_initial.trim() || null,
          unit_prefix_value:   d.unit_prefix_value != null ? Number(d.unit_prefix_value) : null,
          unit_prefix_updated_at: new Date(),
        },
      })
    })
  }

  updateUnitPrefix(id: number, d: any) {
    return this.prisma.units_prefixs.update({
      where: { unit_prefix_id: id },
      data: {
        unit_prefix_name:    d.unit_prefix_name    ?? undefined,
        unit_prefix_initial: d.unit_prefix_initial ?? undefined,
        unit_prefix_value:   d.unit_prefix_value != null ? Number(d.unit_prefix_value) : undefined,
        unit_prefix_updated_at: new Date(),
      },
    })
  }

  deleteUnitPrefix(id: number) { return this.prisma.units_prefixs.delete({ where: { unit_prefix_id: id } }) }
}
