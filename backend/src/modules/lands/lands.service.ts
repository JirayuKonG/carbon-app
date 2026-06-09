import { Prisma } from '@prisma/client'
import { Injectable } from '@nestjs/common'
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

  deleteLand(id: number) {
    return this.prisma.lands.delete({ where: { land_id: id } })
  }

  // ── Camps ──────────────────────────────────────────────────
  getCamps() {
    return this.prisma.lands_camps.findMany({
      orderBy: { land_camp_id: 'asc' },
    })
  }

  async createCamp(data: {
    land_camp_name?: string; land_camp_idCode?: string
    land_camp_latitude?: number; land_camp_longitude?: number
    land_camp_info?: string; land_camp_uid?: number
  }) {
    return this.prisma.lands_camps.create({
      data: { land_camp_id: await this.nextCampId(), ...this.cleanData(data), land_camp_update_at: new Date() } as any,
    })
  }

  updateCamp(id: number, data: Partial<{
    land_camp_name: string; land_camp_idCode: string
    land_camp_latitude: number; land_camp_longitude: number; land_camp_info: string
  }>) {
    return this.prisma.lands_camps.update({ where: { land_camp_id: id }, data: { ...this.cleanData(data), land_camp_update_at: new Date() } })
  }

  deleteCamp(id: number) {
    return this.prisma.lands_camps.delete({ where: { land_camp_id: id } })
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
