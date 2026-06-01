import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class InfraService {
  constructor(private prisma: PrismaService) {}

  // ── Factories ──────────────────────────────────────────────
  getFactories() {
    return this.prisma.factories.findMany({ orderBy: { factory_id: 'asc' } })
  }
  async createFactory(data: { name: string; initial?: string; note?: string; updated_uid?: number }) {
    const now = new Date()

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.factories.aggregate({ _max: { factory_id: true } })
      return tx.factories.create({
        data: {
          factory_id: (last._max.factory_id ?? 0) + 1,
          name: data.name?.trim(),
          initial: data.initial?.trim() || null,
          note: data.note?.trim() || null,
          updated_uid: data.updated_uid,
          update_at: now,
        },
      })
    })
  }
  updateFactory(id: number, data: Partial<{ name: string; initial: string; note: string }>) {
    return this.prisma.factories.update({ where: { factory_id: id }, data: { ...data, update_at: new Date() } })
  }
  deleteFactory(id: number) {
    return this.prisma.factories.delete({ where: { factory_id: id } })
  }

  // ── Service Areas ──────────────────────────────────────────
  getServiceAreas(factoryId?: number) {
    return this.prisma.service_areas.findMany({
      where: factoryId ? { factory_id: factoryId } : undefined,
      include: { factories: { select: { name: true } } },
      orderBy: { service_area_id: 'asc' },
    })
  }
  async createServiceArea(data: { name: string; code?: string; factory_id?: number; note?: string; updated_uid?: number }) {
    const now = new Date()

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.service_areas.aggregate({ _max: { service_area_id: true } })
      return tx.service_areas.create({
        data: {
          service_area_id: (last._max.service_area_id ?? 0) + 1,
          factory_id: data.factory_id,
          updated_uid: data.updated_uid,
          code: data.code?.trim() || null,
          name: data.name?.trim(),
          note: data.note?.trim() || null,
          update_at: now,
        },
      })
    })
  }
  updateServiceArea(id: number, data: Partial<{ name: string; code: string; factory_id: number; note: string }>) {
    return this.prisma.service_areas.update({ where: { service_area_id: id }, data: { ...data, update_at: new Date() } })
  }
  deleteServiceArea(id: number) {
    return this.prisma.service_areas.delete({ where: { service_area_id: id } })
  }

  // ── Departments ────────────────────────────────────────────
  getDepartments() {
    return this.prisma.departments.findMany({ orderBy: { departments_id: 'asc' } })
  }
  async createDepartment(data: { name: string }) {
    const now = new Date()
    const name = data.name?.trim()

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.departments.aggregate({ _max: { departments_id: true } })
      return tx.departments.create({
        data: {
          departments_id: (last._max.departments_id ?? 0) + 1,
          name,
          created_at: now,
          updated_at: now,
        },
      })
    })
  }
  updateDepartment(id: number, data: Partial<{ name: string }>) {
    return this.prisma.departments.update({ where: { departments_id: id }, data: { ...data, updated_at: new Date() } })
  }
  deleteDepartment(id: number) {
    return this.prisma.departments.delete({ where: { departments_id: id } })
  }
}
