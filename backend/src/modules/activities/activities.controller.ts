import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common'
import { ApiTags, ApiQuery } from '@nestjs/swagger'
import { ActivitiesService } from './activities.service'
import { Co2eEngineService } from './co2e-engine.service'

@ApiTags('Activities')
@Controller('activities')
export class ActivitiesController {
  constructor(
    private svc:    ActivitiesService,
    private engine: Co2eEngineService,
  ) {}

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
  @Post('details') createDetail(@Body() b: any) { return this.svc.createDetail(b) }
  @Put('details/:id') updateDetail(@Param('id', ParseIntPipe) id: number, @Body() b: any) { return this.svc.updateDetail(id, b) }
  @Delete('details/:id') deleteDetail(@Param('id', ParseIntPipe) id: number) { return this.svc.deleteDetail(id) }

  // Reference lists
  @Get('header-types')    getHeaderTypes()   { return this.svc.getHeaderTypes() }
  @Get('detail-types')    getDetailTypes(@Query('header_type_id') htid?: string) { return this.svc.getDetailTypes(htid ? +htid : undefined) }
  @Get('resource-types')  getResourceTypes() { return this.svc.getResourceTypes() }
  @Get('fertilizers')     getFertilizers()   { return this.svc.getFertilizers() }
  @Get('equipments')      getEquipments()    { return this.svc.getEquipments() }
  @Get('chemicals')       getChemicals()     { return this.svc.getChemicals() }
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
  importCsv(@Body() b: { mappings: any[]; rows: Record<string, string>[]; calcMode?: 'standard' | 'tver' }) {
    return this.svc.importFromCsv(b.mappings, b.rows, b.calcMode)
  }
}
