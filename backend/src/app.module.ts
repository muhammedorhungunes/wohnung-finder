import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { FiltersModule } from './modules/filters/filters.module';
import { ListingsModule } from './modules/listings/listings.module';
import { ScrapersModule } from './modules/scrapers/scrapers.module';
import { MatcherModule } from './modules/matcher/matcher.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    FiltersModule,
    ListingsModule,
    ScrapersModule,
    MatcherModule,
    NotificationsModule,
    SchedulerModule,
  ],
})
export class AppModule {}
