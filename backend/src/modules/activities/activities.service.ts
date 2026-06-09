import { Injectable, BadRequestException, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { Co2eEngineService } from './co2e-engine.service'

export interface ColumnMapping { targetKey: string; sourceKey: string | null }

const CAL_STATUS_NAMES = {
  imported: 'นำเข้าข้อมูลแล้ว',
  preparing: 'กำลังเตรียมข้อมูล',
  ready: 'พร้อมคำนวณมาตรฐาน',
  standardDone: 'คำนวณแล้ว(มาตรฐาน)',
  cfpDone: 'คำนวณแล้ว(มาตรฐาน,CFP)',
  error: 'คำนวณผิดพลาด',
} as const

type CalStatusName = (typeof CAL_STATUS_NAMES)[keyof typeof CAL_STATUS_NAMES]

type ActivityHeaderPayload = {
  land_id?: number | string | null
  farmer_id?: number | string | null
  activities_header_idCode?: string | null
  activities_header_curlatitude?: number | string | null
  activities_header_curlongitude?: number | string | null
  activities_header_startDate?: Date | string | null
  activities_header_update_uid?: number | string | null
  act_header_type_id?: number | string | null
  act_header_typeLand_id?: number | string | null
  act_header_typeSugarCane_id?: number | string | null
  activities_header_info?: string | null
}

type ActivityDetailPayload = {
  activities_header_id?: number | string | null
  act_header_type_id?: number | string | null
  act_header_detail_type_id?: number | string | null
  act_header_detail_type_update_uid?: number | string | null
  act_equipment_id?: number | string | null
  act_fertilizer_id?: number | string | null
  act_chemiscal_id?: number | string | null
  act_resourceOther_id?: number | string | null
  resource_used_type_id?: number | string | null
  unit_prefix_id?: number | string | null
  unit_id?: number | string | null
  log_act_detail_quatity?: number | string | null
  log_act_detail_volumePerUnit?: number | string | null
  log_act_detail_volumeAll?: number | string | null
  log_act_detail_areawork?: number | string | null
  log_act_detail_create_at?: Date | string | null
  // log_act_detail_create_at is used to date, such as 2024-07-01, but it is not used to time
  calcMode?: 'standard' | 'tver'
}

type FertilizerPayload = {
  act_fertilizer_name?: string | null
  act_fertilizer_info?: string | null
  resource_used_type_id?: number | string | null
}

type EquipmentPayload = {
  act_equipment_name?: string | null
  act_equipment_info?: string | null
  resource_used_type_id?: number | string | null
}

type ResourceOtherPayload = {
  act_resourceOther_name?: string | null
  act_resourceOther_info?: string | null
  resource_used_type_id?: number | string | null
  act_resourceOther_update_uid?: number | string | null
}

type ResourceTypePayload = {
  resc_used_type_name?: string | null
  resc_used_type_info?: string | null
}

type ImportFilePayload = {
  activities_fileNameUse_name?: string | null
  activities_fileNameUse_rowCount?: number | string | null
  activities_fileNameUse_columnCount?: number | string | null
  activities_fileNameUse_update_uid?: number | string | null
}

type CarbonPreparationPayload = {
  preparedUnitId?: number | string | null
  preparedUnitName?: string | null
  preparedUnitInitial?: string | null
  preparedUnitPrefixId?: number | string | null
  preparedVolumeAll?: number | string | null
  preparedVolumePerUnit?: number | string | null
  conversionFactor?: number | string | null
  fertilizerBagWeightKg?: number | string | null
  fertilizerPrepareType?: string | null
  soilSampleDate?: Date | string | null
  soilN?: number | string | null
  soilSocBaseline?: number | string | null
  soilSocProject?: number | string | null
  note?: string | null
}

type CarbonPreparationNormalized = {
  preparedUnitId?: number
  preparedUnitName?: string
  preparedUnitInitial?: string
  preparedUnitPrefixId?: number
  preparedVolumeAll?: number
  preparedVolumePerUnit?: number
  conversionFactor?: number
  fertilizerBagWeightKg?: number
  fertilizerPrepareType?: string
  soilSampleDate?: Date
  soilN?: number
  soilSocBaseline?: number
  soilSocProject?: number
  note?: string
}

@Injectable()
export class ActivitiesService {
  private readonly logger = new Logger(ActivitiesService.name)

  constructor(
    private prisma:  PrismaService,
    private engine:  Co2eEngineService,
  ) {}

  // ── Headers ────────────────────────────────────────────────
  getHeaders(landId?: number, farmerId?: number) {
    return this.prisma.activities_header.findMany({
      where: {
        ...(landId   ? { land_id:   landId }   : {}),
        ...(farmerId ? { farmer_id: farmerId }  : {}),
      },
      include: {
        lands:                  { select: { land_code: true, name: true } },
        activities_header_type: { select: { act_header_type_name_th: true } },
      },
      orderBy: { activities_header_id: 'asc' },
    })
  }

  private toOptionalNumber(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined
    const num = Number(value)
    if (Number.isNaN(num)) throw new BadRequestException(`Invalid number: ${String(value)}`)
    return num
  }

  private toOptionalDate(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined
    const date = value instanceof Date ? value : new Date(String(value))
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`Invalid date: ${String(value)}`)
    return date
  }

  private toOptionalText(value: unknown) {
    if (value === undefined || value === null) return undefined
    const text = String(value).trim()
    return text === '' ? undefined : text
  }

  private toRequiredText(value: unknown, fieldName: string) {
    const text = this.toOptionalText(value)
    if (!text) throw new BadRequestException(`${fieldName} is required`)
    return text
  }

  private normalizeHeaderPayload(data: ActivityHeaderPayload, withCreateAt = false) {
    return {
      land_id:                       this.toOptionalNumber(data.land_id),
      farmer_id:                     this.toOptionalNumber(data.farmer_id),
      activities_header_idCode:      this.toOptionalText(data.activities_header_idCode),
      activities_header_curlatitude: this.toOptionalNumber(data.activities_header_curlatitude),
      activities_header_curlongitude: this.toOptionalNumber(data.activities_header_curlongitude),
      activities_header_startDate:   this.toOptionalDate(data.activities_header_startDate),
      activities_header_update_uid:  this.toOptionalNumber(data.activities_header_update_uid),
      act_header_type_id:            this.toOptionalNumber(data.act_header_type_id),
      act_header_typeLand_id:        this.toOptionalNumber(data.act_header_typeLand_id),
      act_header_typeSugarCane_id:   this.toOptionalNumber(data.act_header_typeSugarCane_id),
      activities_header_info:        this.toOptionalText(data.activities_header_info),
      
      ...(withCreateAt ? { activities_header_create_at: new Date() } : {}), 
      // create_at it returns current timestamp when creating, such as 2024-07-01T00:00:00.000Z, but it is not updated when updating 
    }
  }

  private normalizeDetailPayload(data: ActivityDetailPayload) {
    return {
      activities_header_id:              this.toOptionalNumber(data.activities_header_id),
      act_header_type_id:                this.toOptionalNumber(data.act_header_type_id),
      act_header_detail_type_id:         this.toOptionalNumber(data.act_header_detail_type_id),
      act_header_detail_type_update_uid: this.toOptionalNumber(data.act_header_detail_type_update_uid),
      act_equipment_id:                  this.toOptionalNumber(data.act_equipment_id),
      act_fertilizer_id:                 this.toOptionalNumber(data.act_fertilizer_id),
      act_chemiscal_id:                  this.toOptionalNumber(data.act_chemiscal_id),
      act_resourceOther_id:              this.toOptionalNumber(data.act_resourceOther_id),
      resource_used_type_id:             this.toOptionalNumber(data.resource_used_type_id),
      unit_prefix_id:                    this.toOptionalNumber(data.unit_prefix_id),
      unit_id:                           this.toOptionalNumber(data.unit_id),
      log_act_detail_quatity:            this.toOptionalNumber(data.log_act_detail_quatity),
      log_act_detail_volumePerUnit:      this.toOptionalNumber(data.log_act_detail_volumePerUnit),
      log_act_detail_volumeAll:          this.toOptionalNumber(data.log_act_detail_volumeAll),
      log_act_detail_areawork:           this.toOptionalNumber(data.log_act_detail_areawork),
      log_act_detail_create_at:          this.toOptionalDate(data.log_act_detail_create_at),
      // log_act_detail_create_at is used to date, such as 2024-07-01, but it is not used to time
    }
  }

  private cleanData<T extends Record<string, unknown>>(data: T) {
    return Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined && value !== ''),
    )
  }

  private normalizeImportFilePayload(data: ImportFilePayload) {
    return {
      activities_fileNameUse_name: this.toRequiredText(
        data.activities_fileNameUse_name,
        'activities_fileNameUse_name',
      ),
      activities_fileNameUse_rowCount: this.toOptionalNumber(data.activities_fileNameUse_rowCount),
      activities_fileNameUse_columnCount: this.toOptionalNumber(data.activities_fileNameUse_columnCount),
      activities_fileNameUse_update_uid: this.toOptionalNumber(data.activities_fileNameUse_update_uid),
    }
  }

  private normalizeCarbonPreparationPayload(data: CarbonPreparationPayload): CarbonPreparationNormalized {
    return {
      preparedUnitId: this.toOptionalNumber(data.preparedUnitId),
      preparedUnitName: this.toOptionalText(data.preparedUnitName),
      preparedUnitInitial: this.toOptionalText(data.preparedUnitInitial),
      preparedUnitPrefixId: this.toOptionalNumber(data.preparedUnitPrefixId),
      preparedVolumeAll: this.toOptionalNumber(data.preparedVolumeAll),
      preparedVolumePerUnit: this.toOptionalNumber(data.preparedVolumePerUnit),
      conversionFactor: this.toOptionalNumber(data.conversionFactor),
      fertilizerBagWeightKg: this.toOptionalNumber(data.fertilizerBagWeightKg),
      fertilizerPrepareType: this.toOptionalText(data.fertilizerPrepareType),
      soilSampleDate: this.toOptionalDate(data.soilSampleDate),
      soilN: this.toOptionalNumber(data.soilN),
      soilSocBaseline: this.toOptionalNumber(data.soilSocBaseline),
      soilSocProject: this.toOptionalNumber(data.soilSocProject),
      note: this.toOptionalText(data.note),
    }
  }

  private parseCarbonPreparationInfo(value?: string | null): Record<string, unknown> {
    if (!value) return {}
    try {
      const parsed: unknown = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {}
    } catch {
      return {}
    }
  }

  private buildCarbonPreparationInfo(
    data: CarbonPreparationNormalized,
    sourceDetail: {
      unit_id?: number | null
      unit_prefix_id?: number | null
      log_act_detail_volumePerUnit?: number | null
      log_act_detail_volumeAll?: number | null
    },
    previousInfo: Record<string, unknown> = {},
  ) {
    const info = this.cleanData({
      sourceUnitId: previousInfo.sourceUnitId ?? sourceDetail.unit_id,
      sourceUnitPrefixId: previousInfo.sourceUnitPrefixId ?? sourceDetail.unit_prefix_id,
      sourceVolumePerUnit: previousInfo.sourceVolumePerUnit ?? sourceDetail.log_act_detail_volumePerUnit,
      sourceVolumeAll: previousInfo.sourceVolumeAll ?? sourceDetail.log_act_detail_volumeAll,
      conversionFactor: data.conversionFactor,
      fertilizerBagWeightKg: data.fertilizerBagWeightKg,
      fertilizerPrepareType: data.fertilizerPrepareType,
      soilSampleDate: data.soilSampleDate?.toISOString(),
      soilN: data.soilN,
      soilSocBaseline: data.soilSocBaseline,
      soilSocProject: data.soilSocProject,
      note: data.note,
      preparedAt: new Date().toISOString(),
    })

    return JSON.stringify(info)
  }

  private normalizeCalStatusName(value: string | null | undefined) {
    return (value ?? '').trim()
  }

  private async ensureCalStatusMap() {
    const existing = await this.prisma.log_act_detail_calStatus.findMany({
      select: {
        log_act_detail_calStatus_id: true,
        log_act_detail_calStatus_name: true,
      },
      orderBy: { log_act_detail_calStatus_id: 'asc' },
    })

    const legacyAliases: Partial<Record<CalStatusName, string[]>> = {
      [CAL_STATUS_NAMES.ready]: ['ยังไม่คำนวณ/รอการคำนวณมาตรฐาน', 'รอคำนวณค่ามาตรฐาน'],
      [CAL_STATUS_NAMES.cfpDone]: ['คำนวณแล้ว(มาตรฐาน+CFP)'],
      [CAL_STATUS_NAMES.error]: ['ผิดพลาด'],
    }

    const map: Record<CalStatusName, number> = {} as Record<CalStatusName, number>
    let nextId = existing.reduce((max, item) => Math.max(max, item.log_act_detail_calStatus_id), 0)

    for (const statusName of Object.values(CAL_STATUS_NAMES)) {
      const exact = existing.find((item) => this.normalizeCalStatusName(item.log_act_detail_calStatus_name) === statusName)
      if (exact) {
        map[statusName] = exact.log_act_detail_calStatus_id
        continue
      }

      const legacyName = legacyAliases[statusName]?.find((alias) =>
        existing.some((item) => this.normalizeCalStatusName(item.log_act_detail_calStatus_name) === alias),
      )

      if (legacyName) {
        const legacy = existing.find((item) => this.normalizeCalStatusName(item.log_act_detail_calStatus_name) === legacyName)
        if (legacy) {
          await this.prisma.log_act_detail_calStatus.update({
            where: { log_act_detail_calStatus_id: legacy.log_act_detail_calStatus_id },
            data: { log_act_detail_calStatus_name: statusName },
          })
          legacy.log_act_detail_calStatus_name = statusName
          map[statusName] = legacy.log_act_detail_calStatus_id
          continue
        }
      }

      nextId += 1
      const created = await this.prisma.log_act_detail_calStatus.create({
        data: {
          log_act_detail_calStatus_id: nextId,
          log_act_detail_calStatus_name: statusName,
          create_at: new Date(),
        },
      })
      existing.push(created)
      map[statusName] = created.log_act_detail_calStatus_id
    }

    return map
  }

  private async getCalStatusId(statusName: CalStatusName) {
    const map = await this.ensureCalStatusMap()
    const statusId = map[statusName]
    if (!statusId) {
      throw new BadRequestException(`Missing calculation status: ${statusName}`)
    }
    return statusId
  }

  private getDetailStatusName(detail: { log_act_detail_calStatus?: { log_act_detail_calStatus_name?: string | null } | null }) {
    return this.normalizeCalStatusName(detail.log_act_detail_calStatus?.log_act_detail_calStatus_name)
  }

  private async getDetailForWorkflow(id: number) {
    const detail = await this.prisma.log_activities_detail.findUnique({
      where: { log_act_detail_id: id },
      include: {
        log_act_detail_calStatus: { select: { log_act_detail_calStatus_name: true } },
        activities_header: {
          select: {
            activities_header_startDate: true,
            land_id: true,
            lands: {
              select: {
                land_camp_id: true,
              },
            },
          },
        },
      },
    })

    if (!detail) {
      throw new BadRequestException(`Detail ${id} not found`)
    }

    return detail
  }

  private canTransitionWorkflowStatus(currentStatusName: string, nextStatusName: string) {
    if (nextStatusName === CAL_STATUS_NAMES.preparing) {
      return (
        currentStatusName === CAL_STATUS_NAMES.imported
        || currentStatusName === CAL_STATUS_NAMES.ready
        || currentStatusName === CAL_STATUS_NAMES.standardDone
        || currentStatusName === CAL_STATUS_NAMES.cfpDone
        || currentStatusName === CAL_STATUS_NAMES.error
      )
    }

    if (nextStatusName === CAL_STATUS_NAMES.ready) {
      return currentStatusName === CAL_STATUS_NAMES.preparing
    }

    return false
  }

  private canTransitionManualStatus(currentStatusName: string, nextStatusName: string) {
    if (nextStatusName === CAL_STATUS_NAMES.preparing || nextStatusName === CAL_STATUS_NAMES.ready) {
      return this.canTransitionWorkflowStatus(currentStatusName, nextStatusName)
    }

    if (nextStatusName === CAL_STATUS_NAMES.standardDone) {
      return (
        currentStatusName === CAL_STATUS_NAMES.ready
        || currentStatusName === CAL_STATUS_NAMES.cfpDone
      )
    }

    return false
  }

  private async syncCarbonProcessQueueStatus(detailId: number, statusId: number, tx: any = this.prisma) {
    const existing = await tx.carbon_process_queue.findUnique({
      where: { log_act_detail_id: detailId },
      select: { carbon_process_queue_id: true },
    })

    if (!existing) return null

    return tx.carbon_process_queue.update({
      where: { carbon_process_queue_id: existing.carbon_process_queue_id },
      data: {
        log_act_detail_calStatus_id: statusId,
        carbon_process_queue_updated_at: new Date(),
      },
    })
  }

  private async ensureCarbonProcessQueueForDetail(detail: any, statusId: number, tx: any = this.prisma) {
    const existing = await tx.carbon_process_queue.findUnique({
      where: { log_act_detail_id: detail.log_act_detail_id },
      select: { carbon_process_queue_id: true },
    })

    const now = new Date()
    const landId = detail.activities_header?.land_id ?? undefined
    const landCampId = detail.activities_header?.lands?.land_camp_id ?? undefined
    const dateWork = detail.log_act_detail_create_at ?? detail.activities_header?.activities_header_startDate ?? undefined

    if (existing) {
      return tx.carbon_process_queue.update({
        where: { carbon_process_queue_id: existing.carbon_process_queue_id },
        data: this.cleanData({
          log_act_detail_calStatus_id: statusId,
          land_id: landId,
          land_camp_id: landCampId,
          carbon_process_queue_dateWork: dateWork,
          carbon_process_queue_updated_at: now,
        }),
      })
    }

    const last = await tx.carbon_process_queue.aggregate({
      _max: { carbon_process_queue_id: true },
    })

    const createData = () => this.cleanData({
      carbon_process_queue_id: (last._max.carbon_process_queue_id ?? 0) + 1,
      log_act_detail_id: detail.log_act_detail_id,
      log_act_detail_calStatus_id: statusId,
      land_id: landId,
      land_camp_id: landCampId,
      carbon_process_queue_dateWork: dateWork,
      carbon_process_queue_create_at: now,
      carbon_process_queue_updated_at: now,
    })

    try {
      return await tx.carbon_process_queue.create({
        data: createData(),
      })
    } catch {
      const createdForDetail = await tx.carbon_process_queue.findUnique({
        where: { log_act_detail_id: detail.log_act_detail_id },
        select: { carbon_process_queue_id: true },
      })

      if (createdForDetail) {
        return tx.carbon_process_queue.update({
          where: { carbon_process_queue_id: createdForDetail.carbon_process_queue_id },
          data: this.cleanData({
            log_act_detail_calStatus_id: statusId,
            land_id: landId,
            land_camp_id: landCampId,
            carbon_process_queue_dateWork: dateWork,
            carbon_process_queue_updated_at: now,
          }),
        })
      }

      const retryLast = await tx.carbon_process_queue.aggregate({
        _max: { carbon_process_queue_id: true },
      })

      return tx.carbon_process_queue.create({
        data: this.cleanData({
          ...createData(),
          carbon_process_queue_id: (retryLast._max.carbon_process_queue_id ?? 0) + 1,
        }),
      })
    }
  }

  private async syncCarbonProcessQueueForTransition(
    detail: any,
    currentStatusName: string,
    nextStatusName: CalStatusName,
    statusId: number,
    tx: any = this.prisma,
  ) {
    if (currentStatusName === CAL_STATUS_NAMES.imported && nextStatusName === CAL_STATUS_NAMES.preparing) {
      return this.ensureCarbonProcessQueueForDetail(detail, statusId, tx)
    }

    return this.syncCarbonProcessQueueStatus(detail.log_act_detail_id, statusId, tx)
  }

  private async handleUnchangedWorkflowStatus(
    detail: any,
    statusName:
      | typeof CAL_STATUS_NAMES.preparing
      | typeof CAL_STATUS_NAMES.ready
      | typeof CAL_STATUS_NAMES.standardDone,
    statusId: number,
    tx: any = this.prisma,
  ) {
    if (statusName === CAL_STATUS_NAMES.preparing) {
      await this.ensureCarbonProcessQueueForDetail(detail, statusId, tx)
    } else {
      await this.syncCarbonProcessQueueStatus(detail.log_act_detail_id, statusId, tx)
    }

    return tx.log_activities_detail.findUnique({
      where: { log_act_detail_id: detail.log_act_detail_id },
      include: {
        log_act_detail_calStatus: { select: { log_act_detail_calStatus_name: true } },
      },
    })
  }

  async createHeader(data: ActivityHeaderPayload) {
    const now = new Date()
    const normalized = this.normalizeHeaderPayload(data)
    const code = normalized.activities_header_idCode ?? `ACT-${Date.now()}`

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.activities_header.aggregate({ _max: { activities_header_id: true } })
      const activitiesHeaderId = (last._max.activities_header_id ?? 0) + 1

      return tx.activities_header.create({
        data: {
          activities_header_id: activitiesHeaderId,
          ...this.cleanData(normalized),
          activities_header_idCode: code,
          activities_header_create_at: now,
          // activities_header_create_at it returns current timestamp when creating, such as 2024-07-01T00:00:00.000Z, but it is not updated when updating
        },
      })
    })
  }
    
  updateHeader(id: number, data: ActivityHeaderPayload) {
    return this.prisma.activities_header.update({
      where: { activities_header_id: id },
      data: this.cleanData(this.normalizeHeaderPayload(data)),
    })
  }

  deleteHeader(id: number) {
    return this.prisma.activities_header.delete({ where: { activities_header_id: id } })
  }

  // ── Details ────────────────────────────────────────────────
  getDetails(headerId?: number) {
    return this.prisma.log_activities_detail.findMany({
      where: headerId ? { activities_header_id: headerId } : undefined,
      include: {
        activities_header: {
          select: {
            activities_header_id: true,
            activities_header_idCode: true,
            activities_header_startDate: true,
            land_id: true,
            act_header_typeLand_id: true,
            act_header_typeSugarCane_id: true,
            lands: {
              select: {
                land_code: true,
                name: true,
                land_camp_id: true,
                lands_camps: {
                  select: {
                    land_camp_name: true,
                  },
                },
              },
            },
            activities_header_typeLand: {
              select: {
                act_header_typeLand_name: true,
              },
            },
            activities_header_typeSugarCane: {
              select: {
                act_header_typeSugarCane_name: true,
              },
            },
          },
        },
        activities_fertilizers: { select: { act_fertilizer_name: true } },
        activities_equipments:  { select: { act_equipment_name: true } },
        activities_chemiscals:  { select: { act_chemiscal_name: true } },
        activities_resourceOther: { select: { act_resourceOther_name: true } },
        resource_used_type:     { select: { resc_used_type_name: true } },
        log_act_detail_calStatus: { select: { log_act_detail_calStatus_name: true } },
        units: { select: { unit_name: true, unit_initial: true } },
        units_prefixs: { select: { unit_prefix_name: true, unit_prefix_initial: true, unit_prefix_value: true } },
      },
      orderBy: { log_act_detail_id: 'asc' },
    })
  }

  async createDetail(data: ActivityDetailPayload) {
    const normalized = this.normalizeDetailPayload(data)
    const calStatusId = await this.getCalStatusId(CAL_STATUS_NAMES.imported)
    const createdAt = normalized.log_act_detail_create_at ?? new Date()

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.log_activities_detail.aggregate({ _max: { log_act_detail_id: true } })
      const logActDetailId = (last._max.log_act_detail_id ?? 0) + 1

      return tx.log_activities_detail.create({
        data: {
          log_act_detail_id: logActDetailId,
          ...this.cleanData(normalized),
          log_act_detail_calStatus_id: calStatusId,
          log_act_detail_create_at: createdAt,
        },
      })
    })
  }

  async updateDetail(id: number, data: ActivityDetailPayload) {
    const normalized = this.normalizeDetailPayload(data)
    const currentDetail = await this.getDetailForWorkflow(id)
    const currentStatusName = this.getDetailStatusName(currentDetail)
    const nextStatusName: CalStatusName = (
      currentStatusName === CAL_STATUS_NAMES.standardDone
      || currentStatusName === CAL_STATUS_NAMES.cfpDone
      || currentStatusName === CAL_STATUS_NAMES.error
    )
      ? CAL_STATUS_NAMES.preparing
      : (
        currentStatusName === CAL_STATUS_NAMES.imported
        || currentStatusName === CAL_STATUS_NAMES.preparing
        || currentStatusName === CAL_STATUS_NAMES.ready
      )
        ? currentStatusName
        : CAL_STATUS_NAMES.imported
    const nextStatusId = await this.getCalStatusId(nextStatusName)

    const updated = await this.prisma.log_activities_detail.update({
      where: { log_act_detail_id: id },
      data: {
        ...this.cleanData(normalized),
        log_act_detail_calStatus_id: nextStatusId,
      },
    })
    await this.syncCarbonProcessQueueStatus(id, nextStatusId)
    return updated
  }

  deleteDetail(id: number) {
    return this.prisma.log_activities_detail.delete({ where: { log_act_detail_id: id } })
  }

  // ── Imported file history ─────────────────────────────────
  getImportFiles() {
    return this.prisma.activities_fileNameUse.findMany({
      include: {
        users: {
          select: {
            user_id: true,
            username: true,
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: [
        { activities_fileNameUse_create_at: 'desc' },
        { activities_fileNameUse_id: 'desc' },
      ],
    })
  }

  async createImportFile(data: ImportFilePayload) {
    const normalized = this.normalizeImportFilePayload(data)
    const now = new Date()

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.activities_fileNameUse.aggregate({
        _max: { activities_fileNameUse_id: true },
      })
      const nextId = (last._max.activities_fileNameUse_id ?? 0) + 1

      return tx.activities_fileNameUse.create({
        data: {
          activities_fileNameUse_id: nextId,
          ...this.cleanData(normalized),
          activities_fileNameUse_create_at: now,
          activities_fileNameUse_update_at: now,
        },
      })
    })
  }

  async moveDetailToWorkflowStatus(
    id: number,
    statusName: typeof CAL_STATUS_NAMES.preparing | typeof CAL_STATUS_NAMES.ready,
  ) {
    const detail = await this.getDetailForWorkflow(id)
    const currentStatusName = this.getDetailStatusName(detail)
    const statusId = await this.getCalStatusId(statusName)

    if (currentStatusName === statusName) {
      return this.prisma.$transaction((tx) =>
        this.handleUnchangedWorkflowStatus(detail, statusName, statusId, tx),
      )
    }

    if (!this.canTransitionWorkflowStatus(currentStatusName, statusName)) {
      throw new BadRequestException(`Cannot move detail ${id} from "${currentStatusName || '—'}" to "${statusName}"`)
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.log_activities_detail.update({
        where: { log_act_detail_id: id },
        data: { log_act_detail_calStatus_id: statusId },
        include: {
          log_act_detail_calStatus: { select: { log_act_detail_calStatus_name: true } },
        },
      })
      await this.syncCarbonProcessQueueForTransition(detail, currentStatusName, statusName, statusId, tx)
      return updated
    })
  }

  async moveDetailsToWorkflowStatus(
    ids: number[],
    statusName: typeof CAL_STATUS_NAMES.preparing | typeof CAL_STATUS_NAMES.ready,
  ) {
    if (!ids.length) throw new BadRequestException('No detail IDs provided')

    const updated = []
    for (const id of ids) {
      updated.push(await this.moveDetailToWorkflowStatus(id, statusName))
    }

    return {
      updated: updated.length,
      ids: updated.map((item) => item.log_act_detail_id),
    }
  }

  async moveDetailToManualStatus(
    id: number,
    statusName:
      | typeof CAL_STATUS_NAMES.preparing
      | typeof CAL_STATUS_NAMES.ready
      | typeof CAL_STATUS_NAMES.standardDone,
  ) {
    const detail = await this.getDetailForWorkflow(id)
    const currentStatusName = this.getDetailStatusName(detail)
    const statusId = await this.getCalStatusId(statusName)

    if (currentStatusName === statusName) {
      return this.prisma.$transaction((tx) =>
        this.handleUnchangedWorkflowStatus(detail, statusName, statusId, tx),
      )
    }

    if (!this.canTransitionManualStatus(currentStatusName, statusName)) {
      throw new BadRequestException(`Cannot move detail ${id} from "${currentStatusName || '—'}" to "${statusName}"`)
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.log_activities_detail.update({
        where: { log_act_detail_id: id },
        data: { log_act_detail_calStatus_id: statusId },
        include: {
          log_act_detail_calStatus: { select: { log_act_detail_calStatus_name: true } },
        },
      })
      await this.syncCarbonProcessQueueForTransition(detail, currentStatusName, statusName, statusId, tx)
      return updated
    })
  }

  async moveDetailsToManualStatus(
    ids: number[],
    statusName:
      | typeof CAL_STATUS_NAMES.preparing
      | typeof CAL_STATUS_NAMES.ready
      | typeof CAL_STATUS_NAMES.standardDone,
  ) {
    if (!ids.length) throw new BadRequestException('No detail IDs provided')

    const updated = []
    for (const id of ids) {
      updated.push(await this.moveDetailToManualStatus(id, statusName))
    }

    return {
      updated: updated.length,
      ids: updated.map((item) => item.log_act_detail_id),
    }
  }

  async calculateDetail(id: number, calcMode: 'standard' | 'tver' = 'standard') {
    const detail = await this.getDetailForWorkflow(id)
    const currentStatusName = this.getDetailStatusName(detail)

    if (calcMode === 'standard' && currentStatusName !== CAL_STATUS_NAMES.ready) {
      throw new BadRequestException(`Detail ${id} must be "${CAL_STATUS_NAMES.ready}" before standard calculation`)
    }

    if (
      calcMode === 'tver'
      && currentStatusName !== CAL_STATUS_NAMES.standardDone
      && currentStatusName !== CAL_STATUS_NAMES.cfpDone
    ) {
      throw new BadRequestException(`Detail ${id} must be "${CAL_STATUS_NAMES.standardDone}" before CFP calculation`)
    }

    return this.triggerCalc(
      detail.log_act_detail_id,
      detail.resource_used_type_id ?? undefined,
      detail.log_act_detail_volumeAll ?? undefined,
      detail.log_act_detail_volumePerUnit ?? undefined,
      detail.log_act_detail_quatity ?? undefined,
      calcMode,
    )
  }

  async calculateDetails(ids: number[], calcMode: 'standard' | 'tver' = 'standard') {
    if (!ids.length) throw new BadRequestException('No detail IDs provided')

    const updated = await Promise.all(ids.map((id) => this.calculateDetail(id, calcMode)))
    return {
      updated: updated.length,
      ids: updated.map((item) => item.log_act_detail_id),
    }
  }

  private async triggerCalc(
    detailId: number, resourceTypeId?: number,
    volumeAll?: number, volumePerUnit?: number, quantity?: number,
    calcMode: 'standard' | 'tver' = 'standard',
  ) {
    try {
      const result = await this.engine.calculate({
        volumeAll: volumeAll ?? 0,
        volumePerUnit,
        quantity,
        resourceTypeId,
        calcMode,
      })
      const nextStatusId = await this.getCalStatusId(
        calcMode === 'tver' ? CAL_STATUS_NAMES.cfpDone : CAL_STATUS_NAMES.standardDone,
      )
      const updated = await this.prisma.log_activities_detail.update({
        where: { log_act_detail_id: detailId },
        data:  { log_act_detail_calStatus_id: nextStatusId },
        include: {
          log_act_detail_calStatus: { select: { log_act_detail_calStatus_name: true } },
        },
      })
      await this.syncCarbonProcessQueueStatus(detailId, nextStatusId)
      this.logger.log(`Detail #${detailId} CO2e=${result.co2e_total} kgCO2e`)
      return updated
    } catch {
      const errorStatusId = await this.getCalStatusId(CAL_STATUS_NAMES.error)
      const updated = await this.prisma.log_activities_detail.update({
        where: { log_act_detail_id: detailId },
        data:  { log_act_detail_calStatus_id: errorStatusId },
        include: {
          log_act_detail_calStatus: { select: { log_act_detail_calStatus_name: true } },
        },
      })
      await this.syncCarbonProcessQueueStatus(detailId, errorStatusId)
      return updated
    }
  }

  private getCarbonProcessQueueInclude() {
    return {
      log_act_detail_calStatus: { select: { log_act_detail_calStatus_name: true } },
      lands: { select: { land_code: true, name: true } },
      lands_camps: { select: { land_camp_name: true } },
      units: { select: { unit_name: true, unit_initial: true } },
      units_prefixs: { select: { unit_prefix_name: true, unit_prefix_initial: true, unit_prefix_value: true } },
      log_activities_detail: {
        include: {
          activities_header: {
            select: {
              activities_header_id: true,
              activities_header_idCode: true,
              activities_header_startDate: true,
              land_id: true,
              lands: {
                select: {
                  land_code: true,
                  name: true,
                  land_camp_id: true,
                  lands_camps: {
                    select: {
                      land_camp_name: true,
                    },
                  },
                },
              },
            },
          },
          activities_fertilizers: { select: { act_fertilizer_name: true } },
          activities_equipments: { select: { act_equipment_name: true } },
          activities_chemiscals: { select: { act_chemiscal_name: true } },
          activities_resourceOther: { select: { act_resourceOther_name: true } },
          resource_used_type: { select: { resc_used_type_name: true } },
          log_act_detail_calStatus: { select: { log_act_detail_calStatus_name: true } },
          units: { select: { unit_name: true, unit_initial: true } },
          units_prefixs: { select: { unit_prefix_name: true, unit_prefix_initial: true, unit_prefix_value: true } },
        },
      },
    }
  }

  getCarbonProcessQueue() {
    return this.prisma.carbon_process_queue.findMany({
      include: this.getCarbonProcessQueueInclude(),
      orderBy: [
        { carbon_process_queue_updated_at: 'desc' },
        { carbon_process_queue_id: 'desc' },
      ],
    })
  }

  async updateCarbonProcessQueuePreparation(id: number, data: CarbonPreparationPayload) {
    const normalized = this.normalizeCarbonPreparationPayload(data)
    const now = new Date()

    return this.prisma.$transaction(async (tx) => {
      const queue = await tx.carbon_process_queue.findUnique({
        where: { carbon_process_queue_id: id },
        include: { log_activities_detail: true },
      })

      if (!queue || !queue.log_activities_detail) {
        throw new BadRequestException(`Carbon process queue ${id} not found`)
      }

      const detail = queue.log_activities_detail
      const resolvePreparedUnitId = async () => {
        if (normalized.preparedUnitId != null) return normalized.preparedUnitId

        const unitName = normalized.preparedUnitName?.trim()
        const unitInitial = normalized.preparedUnitInitial?.trim()
        const lookupValues = [unitName, unitInitial].filter((value): value is string => Boolean(value))
        if (!lookupValues.length) return undefined

        const existingUnit = await tx.units.findFirst({
          where: {
            OR: lookupValues.flatMap((value) => [
              { unit_name: { equals: value } },
              { unit_initial: { equals: value } },
            ]),
          },
          orderBy: { unit_id: 'asc' },
        })

        if (existingUnit) return existingUnit.unit_id

        const last = await tx.units.aggregate({ _max: { unit_id: true } })
        const created = await tx.units.create({
          data: {
            unit_id: (last._max.unit_id ?? 0) + 1,
            unit_name: unitName ?? unitInitial,
            unit_initial: unitInitial ?? unitName,
            unit_updated_at: now,
          },
        })

        return created.unit_id
      }

      const preparedUnitId = await resolvePreparedUnitId()
      const resolvedPreparation = {
        ...normalized,
        preparedUnitId,
      }
      const preparationInfo = this.buildCarbonPreparationInfo(
        resolvedPreparation,
        detail,
        this.parseCarbonPreparationInfo(queue.carbon_process_queue_info),
      )

      await tx.log_activities_detail.update({
        where: { log_act_detail_id: detail.log_act_detail_id },
        data: this.cleanData({
          unit_id: preparedUnitId,
          unit_prefix_id: normalized.preparedUnitPrefixId,
          log_act_detail_volumePerUnit: normalized.preparedVolumePerUnit,
          log_act_detail_volumeAll: normalized.preparedVolumeAll,
        }),
      })

      return tx.carbon_process_queue.update({
        where: { carbon_process_queue_id: id },
        data: this.cleanData({
          N: normalized.soilN,
          carbon_process_queue_info: preparationInfo,
          unit_id_resultValue: null,
          unit_prefix_id_resultValue: null,
          carbon_process_queue_updated_at: now,
        }),
        include: this.getCarbonProcessQueueInclude(),
      })
    })
  }

  // ── Reference lists ────────────────────────────────────────
  getHeaderTypes() { 
    return this.prisma.activities_header_type.findMany({ 
      orderBy: { act_header_type_id: 'asc' } }) 
  }
  getDetailTypes(headerTypeId?: number) {
    return this.prisma.activities_header_detail_type.findMany({
      where: headerTypeId ? { act_header_type_id: headerTypeId } : undefined,
    })
  }

  getResourceTypes() {
    return this.prisma.resource_used_type.findMany({
      select: {
        resource_used_type_id: true,
        resc_used_type_name: true,
        resc_used_type_info: true,
      },
      orderBy: { resource_used_type_id: 'asc' },
    })
  }
  getFertilizers()   {
    return this.prisma.activities_fertilizers.findMany({
      include: {
        resource_used_type: { select: { resc_used_type_name: true } },
      },
      orderBy: { act_fertilizer_id: 'asc' },
    })
  }
  getEquipments()    {
    return this.prisma.activities_equipments.findMany({
      include: {
        resource_used_type: { select: { resc_used_type_name: true } },
      },
      orderBy: { act_equipment_id: 'asc' },
    })
  }
  getChemicals()     { return this.prisma.activities_chemiscals.findMany({ orderBy: { act_chemiscal_id: 'asc' } }) }
  getResourceOthers() {
    return this.prisma.activities_resourceOther.findMany({
      include: {
        resource_used_type: { select: { resc_used_type_name: true } },
      },
      orderBy: { act_resourceOther_id: 'asc' },
    })
  }
  getSugarCaneTypes(){ return this.prisma.activities_header_typeSugarCane.findMany() }
  getLandTypes()     { return this.prisma.activities_header_typeLand.findMany() }
  async getCalStatuses() {
    await this.ensureCalStatusMap()
    return this.prisma.log_act_detail_calStatus.findMany({
      orderBy: { log_act_detail_calStatus_id: 'asc' },
    })
  }

  createResourceType(data: ResourceTypePayload) {
    const resc_used_type_name = this.toRequiredText(data.resc_used_type_name, 'resc_used_type_name')
    const resc_used_type_info = this.toOptionalText(data.resc_used_type_info)

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.resource_used_type.aggregate({ _max: { resource_used_type_id: true } })
      const resourceUsedTypeId = (last._max.resource_used_type_id ?? 0) + 1

      return tx.resource_used_type.create({
        data: {
          resource_used_type_id: resourceUsedTypeId,
          resc_used_type_name,
          resc_used_type_info,
          resc_used_type_create_at: new Date(),
        },
        select: {
          resource_used_type_id: true,
          resc_used_type_name: true,
          resc_used_type_info: true,
        },
      })
    })
  }

  updateResourceType(id: number, data: ResourceTypePayload) {
    return this.prisma.resource_used_type.update({
      where: { resource_used_type_id: id },
      data: {
        resc_used_type_name: this.toRequiredText(data.resc_used_type_name, 'resc_used_type_name'),
        resc_used_type_info: this.toOptionalText(data.resc_used_type_info),
        resc_used_type_update_at: new Date(),
      },
      select: {
        resource_used_type_id: true,
        resc_used_type_name: true,
        resc_used_type_info: true,
      },
    })
  }

  deleteResourceType(id: number) {
    return this.prisma.$transaction(async (tx) => {
      await tx.log_activities_detail.updateMany({
        where: { resource_used_type_id: id },
        data: { resource_used_type_id: null },
      })

      await tx.activities_fertilizers.updateMany({
        where: { resource_used_type_id: id },
        data: { resource_used_type_id: null },
      })

      await tx.activities_equipments.updateMany({
        where: { resource_used_type_id: id },
        data: { resource_used_type_id: null },
      })

      await tx.activities_chemiscals.updateMany({
        where: { resource_used_type_id: id },
        data: { resource_used_type_id: null },
      })

      await tx.activities_resourceOther.updateMany({
        where: { resource_used_type_id: id },
        data: { resource_used_type_id: null },
      })

      return tx.resource_used_type.delete({
        where: { resource_used_type_id: id },
      })
    })
  }

  createFertilizer(data: FertilizerPayload) {
    const act_fertilizer_name = this.toRequiredText(data.act_fertilizer_name, 'act_fertilizer_name')
    const act_fertilizer_info = this.toOptionalText(data.act_fertilizer_info)
    const resource_used_type_id = this.toOptionalNumber(data.resource_used_type_id)

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.activities_fertilizers.aggregate({ _max: { act_fertilizer_id: true } })
      const actFertilizerId = (last._max.act_fertilizer_id ?? 0) + 1

      return tx.activities_fertilizers.create({
        data: {
          act_fertilizer_id: actFertilizerId,
          act_fertilizer_name,
          act_fertilizer_info,
          resource_used_type_id,
          act_fertilizer_date_add: new Date(),
        },
        include: {
          resource_used_type: { select: { resc_used_type_name: true } },
        },
      })
    })
  }

  updateFertilizer(id: number, data: FertilizerPayload) {
    return this.prisma.activities_fertilizers.update({
      where: { act_fertilizer_id: id },
      data: {
        act_fertilizer_name: this.toRequiredText(data.act_fertilizer_name, 'act_fertilizer_name'),
        act_fertilizer_info: this.toOptionalText(data.act_fertilizer_info),
        resource_used_type_id: this.toOptionalNumber(data.resource_used_type_id),
        act_fertilizer_update_at: new Date(),
      },
      include: {
        resource_used_type: { select: { resc_used_type_name: true } },
      },
    })
  }

  deleteFertilizer(id: number) {
    return this.prisma.$transaction(async (tx) => {
      await tx.log_activities_detail.updateMany({
        where: { act_fertilizer_id: id },
        data: { act_fertilizer_id: null },
      })

      return tx.activities_fertilizers.delete({
        where: { act_fertilizer_id: id },
      })
    })
  }

  createEquipment(data: EquipmentPayload) {
    const act_equipment_name = this.toRequiredText(data.act_equipment_name, 'act_equipment_name')
    const act_equipment_info = this.toOptionalText(data.act_equipment_info)
    const resource_used_type_id = this.toOptionalNumber(data.resource_used_type_id)

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.activities_equipments.aggregate({ _max: { act_equipment_id: true } })
      const actEquipmentId = (last._max.act_equipment_id ?? 0) + 1

      return tx.activities_equipments.create({
        data: {
          act_equipment_id: actEquipmentId,
          act_equipment_name,
          act_equipment_info,
          resource_used_type_id,
          act_equipment_date_add: new Date(),
        },
        include: {
          resource_used_type: { select: { resc_used_type_name: true } },
        },
      })
    })
  }

  updateEquipment(id: number, data: EquipmentPayload) {
    return this.prisma.activities_equipments.update({
      where: { act_equipment_id: id },
      data: {
        act_equipment_name: this.toRequiredText(data.act_equipment_name, 'act_equipment_name'),
        act_equipment_info: this.toOptionalText(data.act_equipment_info),
        resource_used_type_id: this.toOptionalNumber(data.resource_used_type_id),
      },
      include: {
        resource_used_type: { select: { resc_used_type_name: true } },
      },
    })
  }

  deleteEquipment(id: number) {
    return this.prisma.$transaction(async (tx) => {
      await tx.log_activities_detail.updateMany({
        where: { act_equipment_id: id },
        data: { act_equipment_id: null },
      })

      return tx.activities_equipments.delete({
        where: { act_equipment_id: id },
      })
    })
  }

  createResourceOther(data: ResourceOtherPayload) {
    const act_resourceOther_name = this.toRequiredText(data.act_resourceOther_name, 'act_resourceOther_name')
    const act_resourceOther_info = this.toOptionalText(data.act_resourceOther_info)
    const resource_used_type_id = this.toOptionalNumber(data.resource_used_type_id)
    const act_resourceOther_update_uid = this.toOptionalNumber(data.act_resourceOther_update_uid)
    const now = new Date()

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.activities_resourceOther.aggregate({ _max: { act_resourceOther_id: true } })
      const actResourceOtherId = (last._max.act_resourceOther_id ?? 0) + 1

      return tx.activities_resourceOther.create({
        data: {
          act_resourceOther_id: actResourceOtherId,
          act_resourceOther_name,
          act_resourceOther_info,
          resource_used_type_id,
          act_resourceOther_update_uid,
          act_resourceOther_create_at: now,
          act_resourceOther_update_at: now,
        },
        include: {
          resource_used_type: { select: { resc_used_type_name: true } },
        },
      })
    })
  }

  updateResourceOther(id: number, data: ResourceOtherPayload) {
    return this.prisma.activities_resourceOther.update({
      where: { act_resourceOther_id: id },
      data: {
        act_resourceOther_name: this.toRequiredText(data.act_resourceOther_name, 'act_resourceOther_name'),
        act_resourceOther_info: this.toOptionalText(data.act_resourceOther_info),
        resource_used_type_id: this.toOptionalNumber(data.resource_used_type_id),
        act_resourceOther_update_uid: this.toOptionalNumber(data.act_resourceOther_update_uid),
        act_resourceOther_update_at: new Date(),
      },
      include: {
        resource_used_type: { select: { resc_used_type_name: true } },
      },
    })
  }

  deleteResourceOther(id: number) {
    return this.prisma.$transaction(async (tx) => {
      await tx.log_activities_detail.updateMany({
        where: { act_resourceOther_id: id },
        data: { act_resourceOther_id: null },
      })

      return tx.activities_resourceOther.delete({
        where: { act_resourceOther_id: id },
      })
    })
  }

  private normalizeImportedYear(year: number) {
    return year >= 2400 ? year - 543 : year
  }

  private parseImportDate(value?: string) {
    const text = value?.trim()
    if (!text) return undefined

    const match = text.match(/^(\d{1,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,4})(?:\s+(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/)
    if (match) {
      const [, a, b, c, hh = '0', mm = '0', ss = '0'] = match
      let year = Number(a)
      let month = Number(b)
      let day = Number(c)

      if (a.length <= 2 && c.length === 4) {
        day = Number(a)
        month = Number(b)
        year = Number(c)
      }

      year = this.normalizeImportedYear(year)

      if (
        month < 1 || month > 12
        || day < 1 || day > 31
        || Number(hh) > 23
        || Number(mm) > 59
        || Number(ss) > 59
      ) {
        return undefined
      }

      const parsed = new Date(year, month - 1, day, Number(hh), Number(mm), Number(ss))
      if (
        Number.isNaN(parsed.getTime())
        || parsed.getFullYear() !== year
        || parsed.getMonth() !== month - 1
        || parsed.getDate() !== day
      ) {
        return undefined
      }

      return parsed
    }

    const nativeDate = new Date(text)
    if (Number.isNaN(nativeDate.getTime())) return undefined

    const yearMatch = text.match(/\b(24\d{2}|25\d{2}|26\d{2})\b/)
    if (yearMatch) {
      const importedYear = Number(yearMatch[1])
      const normalizedYear = this.normalizeImportedYear(importedYear)
      if (normalizedYear !== importedYear) {
        nativeDate.setFullYear(normalizedYear)
      }
    }

    return nativeDate
  }

  // ── CSV Import ─────────────────────────────────────────────
  /**
   * Columns from actual xlsx file:
   *   กิจกรรม | ไร่(camp) | แปลง | รายการปัจจัยการผลิต | ปริมาณ | math
   *   ปริมาณใช้ | ไร่(area) | รวมเป็นเงิน | ประเภทปัจจัย | หน่วยนับ Farmpro | ประเภทใหม่
   */
  async importFromCsv(
    mappings: ColumnMapping[],
    rows: Record<string, string>[],
    _calcMode: 'standard' | 'tver' = 'standard',
  ) {
    if (!rows.length) throw new BadRequestException('No rows')

    const mapIdx = Object.fromEntries(mappings.filter(m => m.sourceKey).map(m => [m.targetKey, m.sourceKey!]))

    // Pre-load lookup tables
    const [
      camps,
      lands,
      resourceTypes,
      fertilizers,
      equipments,
      chemicals,
      resourceOthers,
      headerTypes,
      detailTypes,
      units,
      landTypes,
      sugarCaneTypes,
      existingHeaders,
    ] = await this.prisma.$transaction([
      this.prisma.lands_camps.findMany({ select: { land_camp_id: true, land_camp_name: true } }),
      this.prisma.lands.findMany({ select: { land_id: true, land_code: true, name: true, land_camp_id: true, land_size: true } }),
      this.prisma.resource_used_type.findMany({ select: { resource_used_type_id: true, resc_used_type_name: true } }),
      this.prisma.activities_fertilizers.findMany({ select: { act_fertilizer_id: true, act_fertilizer_name: true } }),
      this.prisma.activities_equipments.findMany({ select: { act_equipment_id: true, act_equipment_name: true } }),
      this.prisma.activities_chemiscals.findMany({ select: { act_chemiscal_id: true, act_chemiscal_name: true } }),
      this.prisma.activities_resourceOther.findMany({ select: { act_resourceOther_id: true, act_resourceOther_name: true } }),
      this.prisma.activities_header_type.findMany({ select: { act_header_type_id: true, act_header_type_name_th: true } }),
      this.prisma.activities_header_detail_type.findMany({ select: { act_header_detail_type_id: true, act_header_detail_type_name_th: true } }),
      this.prisma.units.findMany({ select: { unit_id: true, unit_name: true, unit_initial: true } }),
      this.prisma.activities_header_typeLand.findMany({ select: { act_header_typeLand_id: true, act_header_typeLand_name: true } }),
      this.prisma.activities_header_typeSugarCane.findMany({ select: { act_header_typeSugarCane_id: true, act_header_typeSugarCane_name: true } }),
      this.prisma.activities_header.findMany({
        select: {
          activities_header_id: true,
          land_id: true,
          act_header_type_id: true,
          act_header_typeLand_id: true,
          act_header_typeSugarCane_id: true,
          activities_header_startDate: true,
        },
      }),
    ])

    const normalizeKey = (value?: string) => value?.trim().toLowerCase() ?? ''
    const normalizeDetailTypeKey = (value?: string) => normalizeKey(value).replace(/^0.{1,3}-(?=.+)/, '')

    const byName = {
      camp:         Object.fromEntries(camps.map(c => [c.land_camp_name?.toLowerCase() ?? '', c.land_camp_id])),
      land:         Object.fromEntries(lands.map(l => [l.land_code?.toLowerCase() ?? '', l.land_id])),
      resType:      Object.fromEntries(resourceTypes.map(r => [r.resc_used_type_name?.toLowerCase() ?? '', r.resource_used_type_id])),
      resTypeById:  Object.fromEntries(resourceTypes.map(r => [r.resource_used_type_id, r.resc_used_type_name?.trim() ?? ''])),
      detailType:   detailTypes.reduce<Record<string, number>>((acc, d) => {
        const rawKey = normalizeKey(d.act_header_detail_type_name_th ?? undefined)
        const normalizedKey = normalizeDetailTypeKey(d.act_header_detail_type_name_th ?? undefined)
        if (rawKey && !acc[rawKey]) acc[rawKey] = d.act_header_detail_type_id
        if (normalizedKey && !acc[normalizedKey]) acc[normalizedKey] = d.act_header_detail_type_id
        return acc
      }, {}),
      fertilizer:   Object.fromEntries(fertilizers.map(f => [f.act_fertilizer_name?.toLowerCase() ?? '', f.act_fertilizer_id])),
      equipment:    Object.fromEntries(equipments.map(e => [e.act_equipment_name?.toLowerCase() ?? '', e.act_equipment_id])),
      chemical:     Object.fromEntries(chemicals.map(c => [c.act_chemiscal_name?.toLowerCase() ?? '', c.act_chemiscal_id])),
      resourceOther: Object.fromEntries(resourceOthers.map(r => [r.act_resourceOther_name?.toLowerCase() ?? '', r.act_resourceOther_id])),
      headerType:   Object.fromEntries(headerTypes.map(t => [t.act_header_type_name_th?.toLowerCase() ?? '', t.act_header_type_id])),
      landType:     Object.fromEntries(landTypes.flatMap(t => [
        [String(t.act_header_typeLand_id), t.act_header_typeLand_id],
        [t.act_header_typeLand_name?.toLowerCase() ?? '', t.act_header_typeLand_id],
      ])),
      sugarCaneType: Object.fromEntries(sugarCaneTypes.flatMap(t => [
        [String(t.act_header_typeSugarCane_id), t.act_header_typeSugarCane_id],
        [t.act_header_typeSugarCane_name?.toLowerCase() ?? '', t.act_header_typeSugarCane_id],
      ])),
      unit: Object.fromEntries(units.flatMap(u => [
        [u.unit_name?.toLowerCase() ?? '', u.unit_id],
        [u.unit_initial?.toLowerCase() ?? '', u.unit_id],
      ])),
    }

    const findLand = (landCode?: string, campId?: number) => {
      const codeKey = normalizeKey(landCode)
      if (!codeKey) return undefined
      return lands.find(l =>
        normalizeKey(l.land_code ?? undefined) === codeKey
        && (campId == null || l.land_camp_id === campId),
      )
        ?? lands.find(l => normalizeKey(l.land_code ?? undefined) === codeKey)
    }

    const headerCache = new Map<number, { activities_header_id: number; startDateTime: number }>()
    const getHeaderStartTime = (value?: Date | null) => value?.getTime() ?? Number.NEGATIVE_INFINITY

    for (const header of existingHeaders) {
      if (header.land_id == null) continue

      const startDateTime = getHeaderStartTime(header.activities_header_startDate)
      const cached = headerCache.get(header.land_id)
      const isNewerHeader = !cached
        || startDateTime > cached.startDateTime
        || (
          startDateTime === cached.startDateTime
          && header.activities_header_id > cached.activities_header_id
        )

      if (isNewerHeader) {
        headerCache.set(header.land_id, {
          activities_header_id: header.activities_header_id,
          startDateTime,
        })
      }
    }

    const resolveMappedReferenceId = (
      value: string,
      lookup: Record<string, number>,
    ) => {
      const key = normalizeKey(value)
      if (!key) return undefined
      if (lookup[key]) return lookup[key]
      const numeric = Number(key)
      return Number.isFinite(numeric) ? numeric : undefined
    }

    const nextResourceTypeId = async () => {
      const current = await this.prisma.resource_used_type.aggregate({ _max: { resource_used_type_id: true } })
      return (current._max.resource_used_type_id ?? 0) + 1
    }

    const nextUnitId = async () => {
      const current = await this.prisma.units.aggregate({ _max: { unit_id: true } })
      return (current._max.unit_id ?? 0) + 1
    }

    const nextHeaderTypeId = async () => {
      const current = await this.prisma.activities_header_type.aggregate({ _max: { act_header_type_id: true } })
      return (current._max.act_header_type_id ?? 0) + 1
    }

    const ensureHeaderTypeId = async (name?: string) => {
      const key = normalizeKey(name)
      if (!key) return undefined
      if (byName.headerType[key]) return byName.headerType[key]
      const created = await this.prisma.activities_header_type.create({
        data: {
          act_header_type_id: await nextHeaderTypeId(),
          act_header_type_name_th: name,
        },
      })
      byName.headerType[key] = created.act_header_type_id
      return created.act_header_type_id
    }

    const nextDetailTypeId = async () => {
      const current = await this.prisma.activities_header_detail_type.aggregate({ _max: { act_header_detail_type_id: true } })
      return (current._max.act_header_detail_type_id ?? 0) + 1
    }

    const ensureDetailTypeId = async (name?: string, headerTypeId?: number) => {
      const trimmedName = name?.trim()
      const key = normalizeDetailTypeKey(trimmedName)
      if (!key) return undefined
      if (byName.detailType[key]) return byName.detailType[key]

      const created = await this.prisma.activities_header_detail_type.create({
        data: {
          act_header_detail_type_id: await nextDetailTypeId(),
          ...(headerTypeId ? { act_header_type_id: headerTypeId } : {}),
          act_header_detail_type_name_th: trimmedName,
        },
      })

      byName.detailType[normalizeKey(trimmedName)] = created.act_header_detail_type_id
      byName.detailType[key] = created.act_header_detail_type_id
      return created.act_header_detail_type_id
    }

    const ensureResourceTypeId = async (name?: string) => {
      const key = normalizeKey(name)
      if (!key) return undefined
      if (byName.resType[key]) return byName.resType[key]
      const created = await this.prisma.resource_used_type.create({
        data: {
          resource_used_type_id: await nextResourceTypeId(),
          resc_used_type_name: name,
          resc_used_type_create_at: new Date(),
          // resc_used_type_update_at is retunned current timestamp when creating, such as 2024-07-01T00:00:00.000Z, but it is not updated when updating
        },
      })
      byName.resType[key] = created.resource_used_type_id
      return created.resource_used_type_id
    }

    const ensureUnitId = async (name?: string) => {
      const key = normalizeKey(name)
      if (!key) return undefined
      if (byName.unit[key]) return byName.unit[key]
      const created = await this.prisma.units.create({
        data: {
          unit_id: await nextUnitId(),
          unit_name: name,
          unit_initial: name,
          unit_updated_at: new Date(),
        },
      })
      byName.unit[key] = created.unit_id
      return created.unit_id
    }

    const ensureSugarCaneTypeId = async (value?: string) => {
      const trimmedValue = value?.trim()
      const key = normalizeKey(trimmedValue)
      if (!key) return undefined

      if (byName.sugarCaneType[key]) return byName.sugarCaneType[key]

      if (/^\d+$/.test(trimmedValue ?? '')) {
        return Number(trimmedValue)
      }

      const current = await this.prisma.activities_header_typeSugarCane.aggregate({
        _max: { act_header_typeSugarCane_id: true },
      })

      const created = await this.prisma.activities_header_typeSugarCane.create({
        data: {
          act_header_typeSugarCane_id:
            (current._max.act_header_typeSugarCane_id ?? 0) + 1,
          act_header_typeSugarCane_name: trimmedValue,
        },
      })

      byName.sugarCaneType[String(created.act_header_typeSugarCane_id)] = created.act_header_typeSugarCane_id
      byName.sugarCaneType[key] = created.act_header_typeSugarCane_id
      return created.act_header_typeSugarCane_id
    }

    const nextFertilizerId = async () => {
      const current = await this.prisma.activities_fertilizers.aggregate({ _max: { act_fertilizer_id: true } })
      return (current._max.act_fertilizer_id ?? 0) + 1
    }

    const nextEquipmentId = async () => {
      const current = await this.prisma.activities_equipments.aggregate({ _max: { act_equipment_id: true } })
      return (current._max.act_equipment_id ?? 0) + 1
    }

    const nextChemicalId = async () => {
      const current = await this.prisma.activities_chemiscals.aggregate({ _max: { act_chemiscal_id: true } })
      return (current._max.act_chemiscal_id ?? 0) + 1
    }

    const nextResourceOtherId = async () => {
      const current = await this.prisma.activities_resourceOther.aggregate({ _max: { act_resourceOther_id: true } })
      return (current._max.act_resourceOther_id ?? 0) + 1
    }

    const ensureResourceItemIds = async (
      name: string,
      resourceTypeId?: number,
      resourceTypeName?: string,
      itemCategory?: string,
    ) => {
      const key = normalizeKey(name)
      if (!key) return { fertilizerId: undefined, equipmentId: undefined, chemicalId: undefined, resourceOtherId: undefined }

      const explicitCategory = normalizeKey(itemCategory)
      let fertilizerId = byName.fertilizer[key]
      let equipmentId = byName.equipment[key]
      let chemicalId = byName.chemical[key]
      let resourceOtherId = byName.resourceOther[key]

      // When CSV wizard explicitly assigns the item group, honor that choice
      // instead of reusing a name match from a different resource table.
      if (explicitCategory) {
        if (/ปุ๋ย|fertilizer/.test(explicitCategory)) {
          if (fertilizerId) return { fertilizerId, equipmentId: undefined, chemicalId: undefined, resourceOtherId: undefined }
        } else if (/อุปกรณ์|equipment/.test(explicitCategory)) {
          if (equipmentId) return { fertilizerId: undefined, equipmentId, chemicalId: undefined, resourceOtherId: undefined }
        } else if (/เคมี|chemical/.test(explicitCategory)) {
          if (chemicalId) return { fertilizerId: undefined, equipmentId: undefined, chemicalId, resourceOtherId: undefined }
        } else if (/อื่น|other|resourceother|resource_other|พันธุ์|variety|sugarcane|อ้อย/.test(explicitCategory)) {
          if (resourceOtherId) return { fertilizerId: undefined, equipmentId: undefined, chemicalId: undefined, resourceOtherId }
        }
      } else if (fertilizerId || equipmentId || chemicalId || resourceOtherId) {
        return { fertilizerId, equipmentId, chemicalId, resourceOtherId }
      }

      const categoryText = normalizeKey(itemCategory ?? resourceTypeName ?? name)
      const isEquipment = /อุปกรณ์|equipment/.test(categoryText)
      const isChemical = /เคมี|chemical/.test(categoryText)
      const isFertilizer = /ปุ๋ย|fertilizer/.test(categoryText)
      const isResourceOther = /อื่น|other|resourceother|resource_other|พันธุ์|variety|sugarcane|อ้อย/.test(categoryText)

      if (isEquipment) {
        const created = await this.prisma.activities_equipments.create({
          data: {
            act_equipment_id: await nextEquipmentId(),
            act_equipment_name: name,
            act_equipment_date_add: new Date(),
            resource_used_type_id: resourceTypeId,
          },
        })
        equipmentId = created.act_equipment_id
        byName.equipment[key] = equipmentId
      } else if (isChemical) {
        const created = await this.prisma.activities_chemiscals.create({
          data: {
            act_chemiscal_id: await nextChemicalId(),
            act_chemiscal_name: name,
            act_chemiscal_date_add: new Date(),
            resource_used_type_id: resourceTypeId,
          },
        })
        chemicalId = created.act_chemiscal_id
        byName.chemical[key] = chemicalId
      } else if (isResourceOther) {
        const created = await this.prisma.activities_resourceOther.create({
          data: {
            act_resourceOther_id: await nextResourceOtherId(),
            act_resourceOther_name: name,
            act_resourceOther_create_at: new Date(),
            act_resourceOther_update_at: new Date(),
            resource_used_type_id: resourceTypeId,
          },
        })
        resourceOtherId = created.act_resourceOther_id
        byName.resourceOther[key] = resourceOtherId
      } else {
        const created = await this.prisma.activities_fertilizers.create({
          data: {
            act_fertilizer_id: await nextFertilizerId(),
            act_fertilizer_name: name,
            act_fertilizer_date_add: new Date(),
            resource_used_type_id: resourceTypeId,
          },
        })
        fertilizerId = created.act_fertilizer_id
        byName.fertilizer[key] = fertilizerId
      }

      return { fertilizerId, equipmentId, chemicalId, resourceOtherId }
    }

    const nextCampId = async () => {
      const current = await this.prisma.lands_camps.aggregate({ _max: { land_camp_id: true } })
      return (current._max.land_camp_id ?? 0) + 1
    }

    const nextLandId = async () => {
      const current = await this.prisma.lands.aggregate({ _max: { land_id: true } })
      return (current._max.land_id ?? 0) + 1
    }

    const ensureCampId = async (name?: string) => {
      const key = normalizeKey(name)
      if (!key) return undefined
      if (byName.camp[key]) return byName.camp[key]
      const created = await this.prisma.lands_camps.create({
        data: { 
          land_camp_id: await nextCampId(), 
          land_camp_name: name  //
        },
      })
      byName.camp[key] = created.land_camp_id
      return created.land_camp_id   // 
    }

    const syncLandSize = async (landId: number, landSize?: number) => {
      if (landSize == null || Number.isNaN(landSize)) return

      await this.prisma.lands.update({
        where: { land_id: landId },
        data: {
          land_size: landSize,
          update_at: new Date(),
        },
      })

      const existing = lands.find((land) => land.land_id === landId)
      if (existing) existing.land_size = landSize
    }

    const ensurePlaceholderLandId = async (campName?: string) => {
      const landCampId = await ensureCampId(campName)
      if (!landCampId) return undefined

      const placeholderCode = `AUTO-CAMP-${landCampId}`
      const existingPlaceholder = lands.find((land) =>
        land.land_camp_id === landCampId
        && normalizeKey(land.land_code ?? undefined) === normalizeKey(placeholderCode),
      )

      if (existingPlaceholder) {
        byName.land[normalizeKey(placeholderCode)] = existingPlaceholder.land_id
        return existingPlaceholder.land_id
      }

      const created = await this.prisma.lands.create({
        data: {
          land_id: await nextLandId(),
          land_code: placeholderCode,
          name: `[AUTO-CAMP] ${campName?.trim() || `Camp ${landCampId}`}`,
          land_camp_id: landCampId,
          update_at: new Date(),
        },
      })

      lands.push(created)
      byName.land[normalizeKey(placeholderCode)] = created.land_id
      return created.land_id
    }

    const ensureLandId = async (code?: string, campName?: string, landSize?: number) => {
      const key = normalizeKey(code)
      if (!key) return undefined
      const landCampId = await ensureCampId(campName)
      const existingLand = findLand(code, landCampId)
      if (existingLand) {
        byName.land[key] = existingLand.land_id
        await syncLandSize(existingLand.land_id, landSize)
        return existingLand.land_id
      }
      const created = await this.prisma.lands.create({
        data: {
          land_id: await nextLandId(),
          land_code: code,
          name: `name:${code}`,
          land_camp_id: landCampId,
          ...(landSize != null && !Number.isNaN(landSize) ? { land_size: landSize } : {}),
          update_at: new Date(),
        },
      })
      lands.push(created)
      byName.land[key] = created.land_id
      return created.land_id
    }

    const results = { inserted: 0, skipped: 0, errors: [] as string[] }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const get = (key: string) => (mapIdx[key] ? row[mapIdx[key]]?.trim() ?? '' : '')

      try {
        // Resolve land/camp linkage for the activity
        let landId: number | undefined
        const campName = get('land_camp_name')
        const landCode = get('land_code')
        const importedLandSizeRaw = get('land_size')
        const importedLandSize = importedLandSizeRaw ? Number.parseFloat(importedLandSizeRaw) : undefined

        if (!landCode && !campName) {
          results.errors.push(`Row ${i + 2}: ไม่พบไร่/แปลง - ไม่มีทั้ง land_code และ land_camp_name จึงไม่สามารถสร้างกิจกรรมได้`)
          results.skipped++
          continue
        }

        const activityDateRaw = get('log_act_detail_create_at')
        const activityDate = this.parseImportDate(activityDateRaw)
        if (!activityDate) {
          results.errors.push(`Row ${i + 2}: วันที่ผิด/หาย - log_act_detail_create_at ว่างหรือรูปแบบวันที่ไม่ถูกต้อง`)
          results.skipped++
          continue
        }

        if (landCode) {
          const campId = campName ? byName.camp[normalizeKey(campName)] : undefined
          landId = findLand(landCode, campId)?.land_id
            ?? await ensureLandId(landCode, campName, importedLandSize)
          if (landId != null) {
            await syncLandSize(landId, importedLandSize)
          }
        } else if (campName) {
          landId = await ensurePlaceholderLandId(campName)
        }

        if (!landId) {
          results.errors.push(`Row ${i + 2}: ไม่พบ land_code และไม่มี land_camp_name จึงไม่สามารถสร้างกิจกรรมได้`)
          results.skipped++
          continue
        }

        // Resolve header metadata
        const actTypeName = get('act_header_type')
        const actTypeId = await ensureHeaderTypeId(actTypeName)
        const actHeaderTypeLandId = resolveMappedReferenceId(get('act_header_typeLand_id'), byName.landType)
        const actHeaderTypeSugarCaneId = await ensureSugarCaneTypeId(get('act_header_typeSugarCane_id'))

        let activitiesHeaderId = headerCache.get(landId)?.activities_header_id
        if (!activitiesHeaderId) {
          const header = await this.createHeader({
            land_id: landId,
            act_header_type_id: actTypeId,
            act_header_typeLand_id: actHeaderTypeLandId,
            act_header_typeSugarCane_id: actHeaderTypeSugarCaneId,
            activities_header_idCode: `IMP-${Date.now()}-${i}`,
            activities_header_startDate: activityDate,
          })
          activitiesHeaderId = header.activities_header_id
          headerCache.set(landId, {
            activities_header_id: activitiesHeaderId,
            startDateTime: getHeaderStartTime(activityDate),
          })
        }

        // Resolve resource
        const resolvedResourceTypeIdRaw = row['resolved_resource_used_type_id']?.trim() ?? ''
        const resolvedResourceTypeId = resolvedResourceTypeIdRaw ? Number.parseInt(resolvedResourceTypeIdRaw, 10) : undefined
        const resolvedResourceTypeName = row['resolved_resource_used_type_name']?.trim() ?? ''
        const resTypeName  = resolvedResourceTypeName || get('resource_used_type') || byName.resTypeById[resolvedResourceTypeId ?? 0] || ''
        const resTypeId    = resolvedResourceTypeId ?? await ensureResourceTypeId(resTypeName)
        const resourceName = get('resource_item_name')
        const itemCategory = row['resource_item_category']?.trim() ?? ''
        const { fertilizerId, equipmentId, chemicalId, resourceOtherId } = await ensureResourceItemIds(
          resourceName,
          resTypeId,
          resTypeName,
          itemCategory,
        )
        const unitName = get('unit_name')
        const unitId = await ensureUnitId(unitName)

        const resolvedDetailTypeIdRaw = row['resolved_act_header_detail_type_id']?.trim() ?? ''
        const resolvedDetailTypeId = resolvedDetailTypeIdRaw ? Number.parseInt(resolvedDetailTypeIdRaw, 10) : undefined
        const detailTypeName = get('act_header_detail_type')
        const detailTypeId = resolvedDetailTypeId != null && Number.isFinite(resolvedDetailTypeId)
          ? resolvedDetailTypeId
          : await ensureDetailTypeId(detailTypeName, actTypeId)

        const volumeAllRaw  = mapIdx['log_act_detail_volumeAll'] ? row[mapIdx['log_act_detail_volumeAll']]?.trim() ?? '' : ''
        const quantityRaw   = get('log_act_detail_quatity')
        const volumePerUnitRaw = get('log_act_detail_volumePerUnit')

        const quantityNumber = quantityRaw ? Number.parseFloat(quantityRaw) : undefined
        const volumePerUnitNumber = volumePerUnitRaw ? Number.parseFloat(volumePerUnitRaw) : undefined

        const explicitVolumeAll = volumeAllRaw ? Number.parseFloat(volumeAllRaw) : undefined
        const volumeAll = Number.isFinite(explicitVolumeAll)
          ? explicitVolumeAll
          : (Number.isFinite(quantityNumber as number) && Number.isFinite(volumePerUnitNumber as number)
            ? (quantityNumber as number) * (volumePerUnitNumber as number)
            : 0)

        const volumePerUnit = volumePerUnitRaw ? Number.parseFloat(volumePerUnitRaw) || undefined : undefined
        const quantity      = quantityRaw
          ? (Number.isFinite(quantityNumber) ? quantityNumber : 1)
          : 1
        const areawork      = parseFloat(get('log_act_detail_areawork'))   || undefined

        await this.createDetail({
          activities_header_id:      activitiesHeaderId,
          act_header_type_id:        actTypeId,
          act_header_detail_type_id: detailTypeId,
          resource_used_type_id:     resTypeId,
          act_fertilizer_id:         fertilizerId,
          act_equipment_id:          equipmentId,
          act_chemiscal_id:          chemicalId,
          act_resourceOther_id:      resourceOtherId,
          unit_id:                   unitId,
          log_act_detail_quatity:    quantity,
          log_act_detail_volumePerUnit: volumePerUnit,
          log_act_detail_volumeAll:  volumeAll,
          log_act_detail_areawork:   areawork,
          log_act_detail_create_at:  activityDate,
        })

        results.inserted++
      } catch (e: any) {
        results.errors.push(`Row ${i + 2}: ${e.message}`)
        results.skipped++
      }
    }

    return results
  }
}


