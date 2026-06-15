import { Prisma } from '@prisma/client'
import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class LandsService {
  constructor(private prisma: PrismaService) {}

  private cleanData<T extends Record<string, unknown>>(data: T) {
    return Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== '' && value !== undefined),
    )
  }

  private async nextLandId() {
    const current = await this.prisma.lands.aggregate({ _max: { land_id: true } })
    return (current._max.land_id ?? 0) + 1
  }

  private async nextCampId() {
    const current = await this.prisma.lands_camps.aggregate({ _max: { land_camp_id: true } })
    return (current._max.land_camp_id ?? 0) + 1
  }

  private async nextCampGroupId() {
    const current = await this.prisma.lands_camps_groups.aggregate({ _max: { land_camp_group_id: true } })
    return (current._max.land_camp_group_id ?? 0) + 1
  }

  private async nextLandmapId() {
    const current = await this.prisma.landmaps.aggregate({ _max: { landmap_id: true } })
    return (current._max.landmap_id ?? 0) + 1
  }

  private async nextLandmapOwnerId() {
    const current = await this.prisma.landmaps_owner.aggregate({
      _max: { landmap_owner_id: true },
    })
    return (current._max.landmap_owner_id ?? 0) + 1
  }

  // ── Lands ──────────────────────────────────────────────────
  getLands(campId?: number, farmerId?: number) {
    return this.prisma.lands.findMany({
      where: {
        ...(campId   ? { land_camp_id: campId }   : {}),
        ...(farmerId ? { farmer_id:    farmerId }  : {}),
      },
      include: {
        farmers:     { select: { first_name: true, last_name: true } },
        lands_camps: { select: { land_camp_name: true } },
        subdistricts: { select: { name_th: true, zip_code: true } },
        units_prefixs: { select: { unit_prefix_name: true } },
        units: { select: { unit_name: true, unit_initial: true } },
      },
      orderBy: { land_id: 'asc' },
    })
  }

  getLandById(id: number) {
    return this.prisma.lands.findUnique({
      where: { land_id: id },
      include: {
        lands_camps:  true,
        farmers:      { select: { first_name: true, last_name: true, phone: true } },
        subdistricts: { select: { name_th: true, zip_code: true } },
      },
    })
  }

  async createLand(data: {
    land_code?: string; name?: string; farmer_id?: number; land_camp_id?: number
    quota_code?: string; area_size?: number; land_size?: number; land_planSize?: number
    land_unit_prefix_id?: number; land_unit_id?: number; village?: string; zip_code?: string
    latitude?: number; longitude?: number; subdistrict_code?: number; updated_uid?: number
  }) {
    return this.prisma.lands.create({
      data: { land_id: await this.nextLandId(), ...this.cleanData(data), update_at: new Date() } as any,
    })
  }

  updateLand(id: number, data: Partial<{
    land_code: string; name: string; quota_code: string; area_size: number; land_size: number
    land_planSize: number; land_unit_prefix_id: number; land_unit_id: number
    village: string; zip_code: string; latitude: number; longitude: number
    subdistrict_code: number; land_camp_id: number; farmer_id: number
  }>) {
    return this.prisma.lands.update({ where: { land_id: id }, data: { ...this.cleanData(data), update_at: new Date() } })
  }

  async bulkUpdateLandSubdistrict(data: { land_ids?: number[]; subdistrict_code?: number }) {
    const landIds = Array.from(
      new Set(
        (data.land_ids ?? [])
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0),
      ),
    )
    const subdistrictCode = Number(data.subdistrict_code)

    if (landIds.length === 0) {
      throw new BadRequestException('กรุณาเลือกแปลงอย่างน้อย 1 รายการ')
    }

    if (!Number.isInteger(subdistrictCode) || subdistrictCode <= 0) {
      throw new BadRequestException('กรุณาเลือกตำบลปลายทางให้ถูกต้อง')
    }

    const subdistrict = await this.prisma.subdistricts.findUnique({
      where: { subdistricts_id: subdistrictCode },
      select: { subdistricts_id: true, name_th: true, zip_code: true },
    })

    if (!subdistrict) {
      throw new BadRequestException('ไม่พบข้อมูลตำบลที่ต้องการอัปเดต')
    }

    const updateData: Prisma.landsUncheckedUpdateManyInput = {
      subdistrict_code: subdistrict.subdistricts_id,
      update_at: new Date(),
      ...(subdistrict.zip_code ? { zip_code: subdistrict.zip_code } : {}),
    }

    const result = await this.prisma.lands.updateMany({
      where: { land_id: { in: landIds } },
      data: updateData,
    })

    return {
      updatedCount: result.count,
      land_ids: landIds,
      subdistrict: {
        subdistricts_id: subdistrict.subdistricts_id,
        name_th: subdistrict.name_th,
        zip_code: subdistrict.zip_code,
      },
    }
  }

  deleteLand(id: number) {
    return this.prisma.lands.delete({ where: { land_id: id } })
  }

  // ── Camps ──────────────────────────────────────────────────
  getCamps() {
    return this.prisma.lands_camps.findMany({
      include: {
        lands_camps_groups: {
          select: {
            land_camp_group_id: true,
            land_camp_group_idCode: true,
            land_camp_group_name: true,
          },
        },
      },
      orderBy: { land_camp_id: 'asc' },
    })
  }

  async createCamp(data: {
    land_camp_name?: string; land_camp_idCode?: string
    land_camp_latitude?: number; land_camp_longitude?: number
    land_camp_info?: string; land_camp_uid?: number; land_camp_group_id?: number
  }) {
    return this.prisma.lands_camps.create({
      data: { land_camp_id: await this.nextCampId(), ...this.cleanData(data), land_camp_update_at: new Date() } as any,
    })
  }

  updateCamp(id: number, data: Partial<{
    land_camp_name: string; land_camp_idCode: string
    land_camp_latitude: number; land_camp_longitude: number; land_camp_info: string; land_camp_group_id: number
  }>) {
    return this.prisma.lands_camps.update({ where: { land_camp_id: id }, data: { ...this.cleanData(data), land_camp_update_at: new Date() } })
  }

  async bulkUpdateCampGroup(data: { camp_ids?: number[]; land_camp_group_id?: number }) {
    const campIds = Array.from(
      new Set(
        (data.camp_ids ?? [])
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0),
      ),
    )
    const campGroupId = Number(data.land_camp_group_id)

    if (campIds.length === 0) {
      throw new BadRequestException('กรุณาเลือกแคมป์อย่างน้อย 1 รายการ')
    }

    if (!Number.isInteger(campGroupId) || campGroupId <= 0) {
      throw new BadRequestException('กรุณาเลือกกลุ่มไร่ปลายทางให้ถูกต้อง')
    }

    const campGroup = await this.prisma.lands_camps_groups.findUnique({
      where: { land_camp_group_id: campGroupId },
      select: {
        land_camp_group_id: true,
        land_camp_group_idCode: true,
        land_camp_group_name: true,
      },
    })

    if (!campGroup) {
      throw new BadRequestException('ไม่พบข้อมูลกลุ่มไร่ที่ต้องการเชื่อม')
    }

    const result = await this.prisma.lands_camps.updateMany({
      where: { land_camp_id: { in: campIds } },
      data: {
        land_camp_group_id: campGroup.land_camp_group_id,
        land_camp_update_at: new Date(),
      },
    })

    return {
      updatedCount: result.count,
      camp_ids: campIds,
      camp_group: {
        land_camp_group_id: campGroup.land_camp_group_id,
        land_camp_group_idCode: campGroup.land_camp_group_idCode,
        land_camp_group_name: campGroup.land_camp_group_name,
      },
    }
  }

  deleteCamp(id: number) {
    return this.prisma.lands_camps.delete({ where: { land_camp_id: id } })
  }

  // ── Camp groups ───────────────────────────────────────────
  getCampGroups() {
    return this.prisma.lands_camps_groups.findMany({
      include: {
        _count: {
          select: {
            lands_camps: true,
          },
        },
      },
      orderBy: { land_camp_group_id: 'asc' },
    })
  }

  async createCampGroup(data: {
    land_camp_group_idCode?: string
    land_camp_group_name?: string
  }) {
    return this.prisma.lands_camps_groups.create({
      data: {
        land_camp_group_id: await this.nextCampGroupId(),
        ...this.cleanData(data),
        land_camp_group_update_at: new Date(),
      } as any,
    })
  }

  updateCampGroup(id: number, data: Partial<{
    land_camp_group_idCode: string
    land_camp_group_name: string
  }>) {
    return this.prisma.lands_camps_groups.update({
      where: { land_camp_group_id: id },
      data: {
        ...this.cleanData(data),
        land_camp_group_update_at: new Date(),
      },
    })
  }

  deleteCampGroup(id: number) {
    return this.prisma.lands_camps_groups.delete({ where: { land_camp_group_id: id } })
  }

  // ── Landmaps ───────────────────────────────────────────────
  getLandmaps() {
    return this.prisma.landmaps.findMany({ orderBy: { landmap_id: 'asc' } })
  }

  async createLandmap(data: {
    landmap_idCode?: string; landmap_area_size?: number
    landmap_unit_prefix_id?: number; landmap_unit_id?: number
    landmap_latitude?: number; landmap_longitude?: number; landmap_info?: string
  }) {
    return this.prisma.landmaps.create({
      data: { landmap_id: await this.nextLandmapId(), ...this.cleanData(data), landmap_create_at: new Date(), landmap_update_at: new Date() } as any,
    })
  }

  updateLandmap(id: number, data: Partial<{
    landmap_idCode: string; landmap_area_size: number
    landmap_unit_prefix_id: number; landmap_unit_id: number
    landmap_latitude: number; landmap_longitude: number; landmap_info: string
  }>) {
    return this.prisma.landmaps.update({
      where: { landmap_id: id },
      data: { ...this.cleanData(data), landmap_update_at: new Date() },
    })
  }

  deleteLandmap(id: number) {
    return this.prisma.landmaps.delete({ where: { landmap_id: id } })
  }

  // ── Landmap owners ─────────────────────────────────────────
  getLandmapOwners(landmapId?: number) {
    return this.prisma.landmaps_owner.findMany({
      where: landmapId ? { landmap_id: landmapId } : undefined,
      include: {
        farmers:  { select: { first_name: true, last_name: true } },
        landmaps: { select: { landmap_idCode: true } },
      },
    })
  }

  async createLandmapOwner(data: { landmap_id?: number; landmap_owner_fid?: number; landmap_owner_uid?: number; landmap_owner_info?: string }) {
    return this.prisma.landmaps_owner.create({
      data: {
        landmap_owner_id: await this.nextLandmapOwnerId(),
        ...data,
        landmap_owner_create_at: new Date(),
        landmap_owner_update_at: new Date(),
      } as Prisma.landmaps_ownerUncheckedCreateInput,
    })
  }

  // ── Mapping (land ↔ landmap) ───────────────────────────────
  getMappings(landId?: number, landmapId?: number) {
    return this.prisma.lands_landmaps_mapping.findMany({
      where: {
        ...(landId    ? { land_id:    landId }    : {}),
        ...(landmapId ? { landmap_id: landmapId } : {}),
      },
      include: {
        lands:    { select: { land_code: true, name: true } },
        landmaps: { select: { landmap_idCode: true } },
      },
    })
  }
}
