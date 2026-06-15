import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe, BadRequestException, Logger } from '@nestjs/common'
import { ApiTags, ApiQuery } from '@nestjs/swagger'
import { ActivitiesService } from './activities.service'
import { Co2eEngineService } from './co2e-engine.service'

@ApiTags('Activities')
@Controller('activities')
export class ActivitiesController {
  private readonly logger = new Logger(ActivitiesController.name)

  constructor(
    private svc:    ActivitiesService,
    private engine: Co2eEngineService,
  ) {}

  private getErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message
    if (typeof error === 'string') return error
    try {
      return JSON.stringify(error)
    } catch {
      return 'Unknown import error'
    }
  }

  // Headers
  @Get('headers')
  @ApiQuery({ name: 'land_id',   required: false, type: Number })
  @ApiQuery({ name: 'farmer_id', required: false, type: Number })
  getHeaders(@Query('land_id') lid?: string, @Query('farmer_id') fid?: string) {
    return this.svc.getHeaders(lid ? +lid : undefined, fid ? +fid : undefined)
  }
  @Post('headers')          createHeader(@Body() b: any) { return this.svc.createHeader(b) }
  @Put('headers/:id')       updateHeader(@Param('id', ParseIntPipe) id: number, @Body() b: any) { return this.svc.updateHeader(id, b) }
  @Delete('headers/:id')    deleteHeader(@Param('id', ParseIntPipe) id: number) { return this.svc.deleteHeader(id) }

  // Details
  @Get('details')
  @ApiQuery({ name: 'header_id', required: false, type: Number })
  getDetails(@Query('header_id') hid?: string) { return this.svc.getDetails(hid ? +hid : undefined) }
  @Get('input-usage-summary') getInputUsageSummary() { return this.svc.getInputUsageSummary() }
  @Post('details') createDetail(@Body() b: any) { return this.svc.createDetail(b) }
  @Post('details/workflow-status/bulk')
  moveDetailsToWorkflowStatusBulk(@Body() b: { ids: number[]; statusName: 'กำลังเตรียมข้อมูล' | 'พร้อมคำนวณมาตรฐาน' }) {
    return this.svc.moveDetailsToWorkflowStatus(b.ids, b.statusName)
  }
  @Post('details/manual-status/bulk')
  moveDetailsToManualStatusBulk(@Body() b: { ids: number[]; statusName: 'นำเข้าข้อมูลแล้ว' | 'กำลังเตรียมข้อมูล' | 'พร้อมคำนวณมาตรฐาน' | 'คำนวณแล้ว(มาตรฐาน)' }) {
    return this.svc.moveDetailsToManualStatus(b.ids, b.statusName)
  }
  @Post('details/calculate/bulk')
  calculateDetailsBulk(@Body() b: { ids: number[]; calcMode?: 'standard' | 'tver' }) {
    return this.svc.calculateDetails(b.ids, b.calcMode)
  }
  @Post('details/:id/workflow-status')
  moveDetailToWorkflowStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() b: { statusName: 'กำลังเตรียมข้อมูล' | 'พร้อมคำนวณมาตรฐาน' },
  ) {
    return this.svc.moveDetailToWorkflowStatus(id, b.statusName)
  }
  @Post('details/:id/manual-status')
  moveDetailToManualStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() b: { statusName: 'นำเข้าข้อมูลแล้ว' | 'กำลังเตรียมข้อมูล' | 'พร้อมคำนวณมาตรฐาน' | 'คำนวณแล้ว(มาตรฐาน)' },
  ) {
    return this.svc.moveDetailToManualStatus(id, b.statusName)
  }
  @Post('details/:id/calculate')
  calculateDetail(
    @Param('id', ParseIntPipe) id: number,
    @Body() b: { calcMode?: 'standard' | 'tver' },
  ) {
    return this.svc.calculateDetail(id, b.calcMode)
  }
  @Put('details/:id') updateDetail(@Param('id', ParseIntPipe) id: number, @Body() b: any) { return this.svc.updateDetail(id, b) }
  @Delete('details/:id') deleteDetail(@Param('id', ParseIntPipe) id: number) { return this.svc.deleteDetail(id) }

  // Carbon process queue
  @Get('carbon-process-queue')
  getCarbonProcessQueue() {
    return this.svc.getCarbonProcessQueue()
  }

  @Post('carbon-process-queue/calculate/bulk')
  calculateCarbonProcessQueueBulk(@Body() b: { ids: number[] }) {
    return this.svc.calculateCarbonProcessQueueItems(b.ids)
  }

  @Post('carbon-process-queue/:id/calculate')
  calculateCarbonProcessQueueItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() b: {
      resultUnitId?: number
      selectedEfId?: number
      fertilizerUreaEfId?: number
      fertilizerDapEfId?: number
      fertilizerKclEfId?: number
      fertilizerGwpId?: number
      manualFertilizerNPercent?: number
      manualFertilizerP2O5Percent?: number
      manualFertilizerK2OPercent?: number
    },
  ) {
    return this.svc.calculateCarbonProcessQueueItem(id, b)
  }

  @Put('carbon-process-queue/:id/preparation')
  updateCarbonProcessQueuePreparation(@Param('id', ParseIntPipe) id: number, @Body() b: any) {
    return this.svc.updateCarbonProcessQueuePreparation(id, b)
  }

  // Imported file history
  @Get('import-files') getImportFiles() { return this.svc.getImportFiles() }
  @Post('import-files') createImportFile(@Body() b: any) { return this.svc.createImportFile(b) }

  // Reference lists
  @Get('header-types')    getHeaderTypes()   { return this.svc.getHeaderTypes() }
  @Get('detail-types')    getDetailTypes(@Query('header_type_id') htid?: string) { return this.svc.getDetailTypes(htid ? +htid : undefined) }
  @Get('resource-types')  getResourceTypes() { return this.svc.getResourceTypes() }
  @Post('resource-types') createResourceType(@Body() b: any) { return this.svc.createResourceType(b) }
  @Put('resource-types/:id') updateResourceType(@Param('id', ParseIntPipe) id: number, @Body() b: any) { return this.svc.updateResourceType(id, b) }
  @Delete('resource-types/:id') deleteResourceType(@Param('id', ParseIntPipe) id: number) { return this.svc.deleteResourceType(id) }
  @Get('fertilizers')     getFertilizers()   { return this.svc.getFertilizers() }
  @Post('fertilizers')    createFertilizer(@Body() b: any) { return this.svc.createFertilizer(b) }
  @Put('fertilizers/:id') updateFertilizer(@Param('id', ParseIntPipe) id: number, @Body() b: any) { return this.svc.updateFertilizer(id, b) }
  @Delete('fertilizers/:id') deleteFertilizer(@Param('id', ParseIntPipe) id: number) { return this.svc.deleteFertilizer(id) }
  @Get('equipments')      getEquipments()    { return this.svc.getEquipments() }
  @Post('equipments')     createEquipment(@Body() b: any) { return this.svc.createEquipment(b) }
  @Put('equipments/:id')  updateEquipment(@Param('id', ParseIntPipe) id: number, @Body() b: any) { return this.svc.updateEquipment(id, b) }
  @Delete('equipments/:id') deleteEquipment(@Param('id', ParseIntPipe) id: number) { return this.svc.deleteEquipment(id) }
  @Get('chemicals')       getChemicals()     { return this.svc.getChemicals() }
  @Get('resource-others') getResourceOthers(){ return this.svc.getResourceOthers() }
  @Post('resource-others') createResourceOther(@Body() b: any) { return this.svc.createResourceOther(b) }
  @Put('resource-others/:id') updateResourceOther(@Param('id', ParseIntPipe) id: number, @Body() b: any) { return this.svc.updateResourceOther(id, b) }
  @Delete('resource-others/:id') deleteResourceOther(@Param('id', ParseIntPipe) id: number) { return this.svc.deleteResourceOther(id) }
  @Get('sugarcane-types') getSugarCaneTypes(){ return this.svc.getSugarCaneTypes() }
  @Get('land-types')      getLandTypes()     { return this.svc.getLandTypes() }
  @Get('cal-statuses')    getCalStatuses()   { return this.svc.getCalStatuses() }

  // CO2e calculation preview (non-persisting)
  @Post('calculate')
  calculatePreview(@Body() b: {
    volumeAll: number; volumePerUnit?: number; quantity?: number
    resourceTypeId?: number; fertilizerId?: number
    calcMode?: 'standard' | 'tver'
  }) {
    return this.engine.calculate(b)
  }

  // CSV import — body: { mappings, rows, calcMode? }
  @Post('import')
  async importCsv(@Body() b: { mappings: any[]; rows: Record<string, string>[]; calcMode?: 'standard' | 'tver' }) {
    if (!Array.isArray(b?.mappings) || !Array.isArray(b?.rows)) {
      throw new BadRequestException('CSV import requires mappings and rows arrays')
    }

    try {
      return await this.svc.importFromCsv(b.mappings, b.rows, b.calcMode)
    } catch (error) {
      const message = this.getErrorMessage(error)
      this.logger.error(`CSV import failed: ${message}`, error instanceof Error ? error.stack : undefined)
      throw new BadRequestException(`CSV import failed: ${message}`)
    }
  }
}
