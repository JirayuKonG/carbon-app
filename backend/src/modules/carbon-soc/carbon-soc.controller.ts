import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { CarbonSocService } from './carbon-soc.service'

@ApiTags('Carbon SOC')
@Controller('carbon-soc')
export class CarbonSocController {
  constructor(private svc: CarbonSocService) {}

  @Get('summary')
  getSummary() {
    return this.svc.getSummary()
  }

  @Get('soc-measurements')
  getSocMeasurements() {
    return this.svc.getSocMeasurements()
  }

  @Post('soc-measurements')
  createSocMeasurement(@Body() body: any) {
    return this.svc.createSocMeasurement(body)
  }

  @Put('soc-measurements/:id')
  updateSocMeasurement(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.svc.updateSocMeasurement(id, body)
  }

  @Delete('soc-measurements/:id')
  deleteSocMeasurement(@Param('id', ParseIntPipe) id: number) {
    return this.svc.deleteSocMeasurement(id)
  }

  @Post('soc-measurements/:id/calculate')
  calculateSocMeasurement(@Param('id', ParseIntPipe) id: number) {
    return this.svc.calculateSocMeasurement(id)
  }

  @Get('soil-improvement-plants')
  getSoilImprovementPlants() {
    return this.svc.getSoilImprovementPlants()
  }

  @Post('soil-improvement-plants')
  createSoilImprovementPlant(@Body() body: any) {
    return this.svc.createSoilImprovementPlant(body)
  }

  @Put('soil-improvement-plants/:id')
  updateSoilImprovementPlant(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.svc.updateSoilImprovementPlant(id, body)
  }

  @Delete('soil-improvement-plants/:id')
  deleteSoilImprovementPlant(@Param('id', ParseIntPipe) id: number) {
    return this.svc.deleteSoilImprovementPlant(id)
  }

  @Post('soil-improvement-plants/:id/calculate')
  calculateSoilImprovementPlant(@Param('id', ParseIntPipe) id: number) {
    return this.svc.calculateSoilImprovementPlant(id)
  }
}
