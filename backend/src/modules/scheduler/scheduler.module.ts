import { Module } from '@nestjs/common';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';
import { FiltersModule } from '../filters/filters.module';
import { ScrapersModule } from '../scrapers/scrapers.module';
import { MatcherModule } from '../matcher/matcher.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [FiltersModule, ScrapersModule, MatcherModule, NotificationsModule],
  providers: [SchedulerService],
  controllers: [SchedulerController],
})
export class SchedulerModule {}
