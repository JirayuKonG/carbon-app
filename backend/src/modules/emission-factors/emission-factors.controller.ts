import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe, BadRequestException } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { EmissionFactorsService } from './emission-factors.service'

@ApiTags('EmissionFactors')
@Controller('emission-factors')
export class EmissionFactorsController {
  constructor(private svc: EmissionFactorsService) {}

  // EF coefficients
  @Get('coefficients')   getCoefficients(@Query('group_id') gid?: string, @Query('cf_type_id') ctid?: string) { return this.svc.getCoefficients(gid ? +gid : undefined, ctid ? +ctid : undefined) }
  @Post('coefficients')  createCoef(@Body() b: any)  { return this.svc.createCoefficient(b) }
  @Put('coefficients/:id')  updateCoef(@Param('id', ParseIntPipe) id: number, @Body() b: any) { return this.svc.updateCoefficient(id, b) }
  @Delete('coefficients/:id') deleteCoef(@Param('id', ParseIntPipe) id: number) { return this.svc.deleteCoefficient(id) }

  // GWP
  @Get('gwp')      getGwp()                                            { return this.svc.getGwp() }
  @Post('gwp')     createGwp(@Body() b: any)                          { return this.svc.createGwp(b) }
  @Put('gwp/:id')  updateGwp(@Param('id', ParseIntPipe) id: number, @Body() b: any) { return this.svc.updateGwp(id, b) }

  // CF types
  @Get('cf-types')      getCfTypes()            { return this.svc.getCfTypes() }
  @Post('cf-types')     createCfType(@Body() b: any) { return this.svc.createCfType(b) }
  @Put('cf-types/:id')  updateCfType(@Param('id', ParseIntPipe) id: number, @Body() b: any) { return this.svc.updateCfType(id, b) }

  // Groups
  @Get('groups')      getGroups(@Query('cf_type_id') ctid?: string)  { return this.svc.getGroups(ctid ? +ctid : undefined) }
  @Post('groups')     createGroup(@Body() b: any)                    { return this.svc.createGroup(b) }
  @Put('groups/:id')  updateGroup(@Param('id', ParseIntPipe) id: number, @Body() b: any) { return this.svc.updateGroup(id, b) }

  // --------------------Units
  @Get('units') getUnits() { return this.svc.getUnits() }

  @Post('units')
  async createUnit(@Body() b: any) {
    // try { return await this.svc.createUnit(b) }
    try { return this.svc.createUnit(b) }
    catch (e: any) { throw new BadRequestException(e?.message ?? 'Insert unit failed') }
  }

  @Put('units/:id')
  async updateUnit(@Param('id', ParseIntPipe) id: number, @Body() b: any) {
    try { return this.svc.updateUnit(id, b) }
    // try { return await this.svc.updateUnit(id, b) }
    catch (e: any) { throw new BadRequestException(e?.message ?? 'Update unit failed') }
  }

  @Delete('units/:id')
  async deleteUnit(@Param('id', ParseIntPipe) id: number) {
    // try { return await this.svc.deleteUnit(id) }
    try { return this.svc.deleteUnit(id) }
    catch (e: any) { throw new BadRequestException(e?.message ?? 'Delete unit failed') }
  }

  // --------------------Unit prefixes
  @Get('unit-prefixs')   getUnitPrefixs() { return this.svc.getUnitPrefixs() }

  @Post('unit-prefixs')
  async createUnitPrefix(@Body() b: any) {
    try { return await this.svc.createUnitPrefix(b) }
    catch (e: any) { throw new BadRequestException(e?.message ?? 'Insert unit prefix failed') }
  }

  @Put('unit-prefixs/:id')
  async updateUnitPrefix(@Param('id', ParseIntPipe) id: number, @Body() b: any) {
    try { return await this.svc.updateUnitPrefix(id, b) }
    catch (e: any) { throw new BadRequestException(e?.message ?? 'Update unit prefix failed') }
  }

  @Delete('unit-prefixs/:id')
  async deleteUnitPrefix(@Param('id', ParseIntPipe) id: number) {
    try { return await this.svc.deleteUnitPrefix(id) }
    catch (e: any) { throw new BadRequestException(e?.message ?? 'Delete unit prefix failed') }
  }
}
