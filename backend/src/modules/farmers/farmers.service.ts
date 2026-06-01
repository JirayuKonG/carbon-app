import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class FarmersService {
  constructor(private prisma: PrismaService) {}

  getFarmers(factoryId?: number, serviceAreaId?: number) {
    return this.prisma.farmers.findMany({
      where: {
        ...(factoryId     ? { factory_id:      factoryId }     : {}),
        ...(serviceAreaId ? { service_area_id: serviceAreaId } : {}),
      },
      include: {
        factories:     { select: { name: true } },
        service_areas: { select: { name: true } },
      },
      orderBy: { farmer_id: 'asc' },
    })
  }

  getFarmerById(id: number) {
    return this.prisma.farmers.findUnique({
      where: { farmer_id: id },
      include: { lands: true },
    })
  }

  async createFarmer(data: {
    first_name: string; last_name: string
    thai_national_id?: string; thai_farmer_id?: string
    phone?: string; line_user_id?: string
    factory_id?: number; service_area_id?: number
    updated_uid?: number
  }) {
    const now = new Date()

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.farmers.aggregate({ _max: { farmer_id: true } })
      return tx.farmers.create({
        data: {
          farmer_id: (last._max.farmer_id ?? 0) + 1,
          first_name: data.first_name?.trim(),
          last_name: data.last_name?.trim(),
          thai_national_id: data.thai_national_id?.trim() || null,
          thai_farmer_id: data.thai_farmer_id?.trim() || null,
          phone: data.phone?.trim() || null,
          line_user_id: data.line_user_id?.trim() || null,
          factory_id: data.factory_id,
          service_area_id: data.service_area_id,
          updated_uid: data.updated_uid,
          update_at: now,
        },
      })
    })
  }

  updateFarmer(id: number, data: Partial<{
    first_name: string; last_name: string; phone: string
    thai_national_id: string; thai_farmer_id: string
    line_user_id: string
    factory_id: number; service_area_id: number
  }>) {
    return this.prisma.farmers.update({
      where: { farmer_id: id },
      data: {
        ...data,
        first_name: data.first_name?.trim(),
        last_name: data.last_name?.trim(),
        phone: data.phone?.trim() || null,
        thai_national_id: data.thai_national_id?.trim() || null,
        thai_farmer_id: data.thai_farmer_id?.trim() || null,
        line_user_id: data.line_user_id?.trim() || null,
        update_at: new Date(),
      },
    })
  }

  deleteFarmer(id: number) {
    return this.prisma.farmers.delete({ where: { farmer_id: id } })
  }
}
