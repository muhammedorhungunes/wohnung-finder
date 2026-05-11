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

  @Cron('0 */4 * * *')
  async handleScrapeAndNotify() {
    this.logger.log('Scraping started...');
    const activeFilters = await this.filters.findActive();
    for (const filter of activeFilters) {
      if (!filter.platforms.includes(Platform.EBAY)) continue;
      try {
        await this.ebayScraper.fetchAndUpsert(filter);
      } catch (err) {
        this.logger.error(`Scraping failed for filter "${filter.name}": ${err}`);
      }
    }

    this.logger.log('Matching started...');
    try {
      await this.matcher.matchNewListings();
    } catch (err) {
      this.logger.error(`Matching failed: ${err}`);
    }

    this.logger.log('Sending notifications...');
    try {
      await this.notifications.sendPendingMatches();
    } catch (err) {
      this.logger.error(`Notifications failed: ${err}`);
    }

    this.logger.log('Run completed.');
  }
}
