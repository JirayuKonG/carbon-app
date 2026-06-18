import { Module } from '@nestjs/common'
import { CarbonSocController } from './carbon-soc.controller'
import { CarbonSocService } from './carbon-soc.service'

@Module({ controllers: [CarbonSocController], providers: [CarbonSocService] })
export class CarbonSocModule {}
