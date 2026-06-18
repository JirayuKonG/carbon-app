import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule }          from './modules/prisma/prisma.module'
import { GeoModule }             from './modules/geo/geo.module'
import { InfraModule }           from './modules/infra/infra.module'
import { UsersModule }           from './modules/users/users.module'
import { FarmersModule }         from './modules/farmers/farmers.module'
import { LandsModule }           from './modules/lands/lands.module'
import { WeatherModule }         from './modules/weather/weather.module'
import { EmissionFactorsModule } from './modules/emission-factors/emission-factors.module'
import { ActivitiesModule }      from './modules/activities/activities.module'
import { AnalyticsModule }       from './modules/analytics/analytics.module'
import { CarbonSocModule }       from './modules/carbon-soc/carbon-soc.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    GeoModule,
    InfraModule,
    UsersModule,
    FarmersModule,
    LandsModule,
    WeatherModule,
    EmissionFactorsModule,
    ActivitiesModule,
    AnalyticsModule,
    CarbonSocModule,
  ],
})
export class AppModule {}
