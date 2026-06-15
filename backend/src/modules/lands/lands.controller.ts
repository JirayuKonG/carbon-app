import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common'
import { ApiTags, ApiQuery } from '@nestjs/swagger'
import { LandsService } from './lands.service'

@ApiTags('Lands')
@Controller('lands')
export class LandsController {
  constructor(private svc: LandsService) {}

  // lands
  @Get()
  @ApiQuery({ name: 'camp_id',   required: false, type: Number })
  @ApiQuery({ name: 'farmer_id', required: false, type: Number })
  getLands(@Query('camp_id') cid?: string, @Query('farmer_id') fid?: string) {
    return this.svc.getLands(cid ? +cid : undefined, fid ? +fid : undefined)
  }

  // camps
  @Get('camps')              getCamps()                                          { return this.svc.getCamps() }
  @Post('camps')             createCamp(@Body() b: any)                         { return this.svc.createCamp(b) }
  @Put('camps/:id')          updateCamp(@Param('id', ParseIntPipe) id: number, @Body() b: any) { return this.svc.updateCamp(id, b) }
  @Delete('camps/:id')       deleteCamp(@Param('id', ParseIntPipe) id: number) { return this.svc.deleteCamp(id) }

  // landmaps
  @Get('landmaps')           getLandmaps()               { return this.svc.getLandmaps() }
  @Post('landmaps')          createLandmap(@Body() b: any) { return this.svc.createLandmap(b) }
  @Put('landmaps/:id')       updateLandmap(@Param('id', ParseIntPipe) id: number, @Body() b: any) { return this.svc.updateLandmap(id, b) }
  @Delete('landmaps/:id')    deleteLandmap(@Param('id', ParseIntPipe) id: number) { return this.svc.deleteLandmap(id) }

  // owners
  @Get('landmaps/owners')
  @ApiQuery({ name: 'landmap_id', required: false, type: Number })
  getLandmapOwners(@Query('landmap_id') lid?: string) { return this.svc.getLandmapOwners(lid ? +lid : undefined) }
  @Post('landmaps/owners')   createLandmapOwner(@Body() b: any) { return this.svc.createLandmapOwner(b) }

  // mapping
  @Get('mapping')
  @ApiQuery({ name: 'land_id',    required: false, type: Number })
  @ApiQuery({ name: 'landmap_id', required: false, type: Number })
  getMappings(@Query('land_id') lid?: string, @Query('landmap_id') mid?: string) {
    return this.svc.getMappings(lid ? +lid : undefined, mid ? +mid : undefined)
  }

  @Put('bulk/subdistrict')
  bulkUpdateLandSubdistrict(@Body() b: any) {
    return this.svc.bulkUpdateLandSubdistrict(b)
  }

  @Get(':id')    getLandById(@Param('id', ParseIntPipe) id: number)  { return this.svc.getLandById(id) }
  @Post()        createLand(@Body() b: any)                           { return this.svc.createLand(b) }
  @Put(':id')    updateLand(@Param('id', ParseIntPipe) id: number, @Body() b: any) { return this.svc.updateLand(id, b) }
  @Delete(':id') deleteLand(@Param('id', ParseIntPipe) id: number)   { return this.svc.deleteLand(id) }
}
