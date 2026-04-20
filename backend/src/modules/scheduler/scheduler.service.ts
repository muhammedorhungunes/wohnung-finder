import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FiltersService } from '../filters/filters.service';
import { EbayScraperService } from '../scrapers/ebay.scraper.service';
import { MatcherService } from '../matcher/matcher.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Platform } from '@prisma/client';

/**
 * Her 2 saatte bir (0. dakikada) scraping + matching + WhatsApp bildirimi.
 * Cron: 0 */2 * * * = saat 0, 2, 4, 6, ...
 */
@Injectable()
export class SchedulerService {
  constructor(
    private readonly filters: FiltersService,
    private readonly ebayScraper: EbayScraperService,
    private readonly matcher: MatcherService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('0 */2 * * *')
  async handleScrapeAndNotify() {
    const activeFilters = await this.filters.findActive();
    for (const filter of activeFilters) {
      if (!filter.platforms.includes(Platform.EBAY)) continue;
      await this.ebayScraper.fetchAndUpsert(filter);
    }
    await this.matcher.matchNewListings();
    await this.notifications.sendPendingMatches();
  }
}
