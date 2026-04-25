import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FiltersService } from '../filters/filters.service';
import { EbayScraperService } from '../scrapers/ebay.scraper.service';
import { MatcherService } from '../matcher/matcher.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Platform } from '@prisma/client';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly filters: FiltersService,
    private readonly ebayScraper: EbayScraperService,
    private readonly matcher: MatcherService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('0 */2 * * *')
  async handleScrapeAndNotify() {
    this.logger.log('Scraping started...');
    const activeFilters = await this.filters.findActive();
    for (const filter of activeFilters) {
      if (!filter.platforms.includes(Platform.EBAY)) continue;
      await this.ebayScraper.fetchAndUpsert(filter);
    }

    this.logger.log('Matching started...');
    await this.matcher.matchNewListings();

    this.logger.log('Sending notifications...');
    await this.notifications.sendPendingMatches();

    this.logger.log('Run completed.');
  }
}
