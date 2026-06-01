import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags, ApiQuery }       from '@nestjs/swagger'
import { AnalyticsService }        from './analytics.service'

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private svc: AnalyticsService) {}

  @Get('summary')      getSummary()    { return this.svc.getSummary() }
  @Get('by-camp')      getByCamp()     { return this.svc.getByCamp() }
  @Get('by-activity')  getByActivity() { return this.svc.getByActivity() }

  @Get('by-land')
  @ApiQuery({ name: 'camp_id', required: false, type: Number })
  getByLand(@Query('camp_id') cid?: string) { return this.svc.getByLand(cid ? +cid : undefined) }

  @Get('compare-camps')
  @ApiQuery({ name: 'ids', required: true, type: String, description: 'comma-separated camp IDs' })
  compareCamps(@Query('ids') ids: string) {
    const campIds = (ids ?? '').split(',').map(Number).filter(Boolean)
    return this.svc.getMultiCampComparison(campIds)
  }

  @Get('cf-kpi')
  getCfKpi(@Query('level') level?: string, @Query('id') id?: string) {
    return this.svc.getCfKpi({ level: this.filterLevel(level), id })
  }

  @Get('cf-trend')
  getCfTrend(@Query('level') level?: string, @Query('id') id?: string) {
    return this.svc.getCfTrend({ level: this.filterLevel(level), id })
  }

  @Get('cf-process')
  getCfProcess(@Query('level') level?: string, @Query('id') id?: string) {
    return this.svc.getCfProcess({ level: this.filterLevel(level), id })
  }

  @Get('cf-transport')
  getCfTransport(@Query('level') level?: string, @Query('id') id?: string) {
    return this.svc.getCfTransport({ level: this.filterLevel(level), id })
  }

  @Get('cf-process-activities')
  getCfProcessActivities(
    @Query('kind') kind?: string,
    @Query('level') level?: string,
    @Query('id') id?: string,
  ) {
    const selectedKind = kind === 'process' || kind === 'transport' ? kind : 'all'
    return this.svc.getCfProcessActivities(selectedKind, { level: this.filterLevel(level), id })
  }

  @Get('cf-spatial-nodes')
  getCfSpatialNodes(@Query('level') level?: string, @Query('id') id?: string) {
    return this.svc.getCfSpatialNodes({ level: this.filterLevel(level), id })
  }

  @Get('cf-report-summary')
  getCfReportSummary(@Query('level') level?: string, @Query('id') id?: string) {
    return this.svc.getCfReportSummary({ level: this.filterLevel(level), id })
  }

  private filterLevel(level?: string) {
    const allowed = ['all', 'region', 'province', 'district', 'subdistrict', 'field']
    return allowed.includes(level ?? '') ? level as 'all' | 'region' | 'province' | 'district' | 'subdistrict' | 'field' : 'all'
  }
}
