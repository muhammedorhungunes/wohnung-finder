import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { ListingsService } from '../listings/listings.service';
import { Platform, Filter } from '@prisma/client';
import { normalizeCity } from '../../utils/city.util';

export interface ScraperResult {
  externalId: string;
  title: string;
  price: number | null;
  rooms: number | null;
  sizeM2: number | null;
  address: string | null;
  city: string | null;
  url: string;
  images: string[];
}

@Injectable()
export class EbayScraperService {
  private readonly logger = new Logger(EbayScraperService.name);

  constructor(
    private readonly listings: ListingsService,
    private readonly config: ConfigService,
  ) {}

  async fetchAndUpsert(filter: Filter): Promise<number> {
    const results = await this.fetchListings(filter);
    if (results.length === 0) return 0;

    await this.listings.upsertMany(
      results.map((r) => ({
        platform: Platform.EBAY,
        externalId: r.externalId,
        title: r.title,
        price: r.price,
        rooms: r.rooms,
        sizeM2: r.sizeM2,
        address: r.address,
        city: r.city,
        url: r.url,
        images: r.images,
      })),
    );

    this.logger.log(`${results.length} listings processed for filter "${filter.name}"`);
    return results.length;
  }

  private async fetchListings(filter: Filter): Promise<ScraperResult[]> {
    const url = this.buildSearchUrl(filter);
    this.logger.debug(`Scraping URL: ${url}`);

    const html = await this.loadPage(url);
    const results = this.parseListings(html, filter.city);
    this.logger.debug(`Parsed listings: ${results.length}`);
    return results;
  }

  private buildSearchUrl(filter: Filter): string {
    const base = 'https://www.kleinanzeigen.de/s-wohnungen-suche';
    const city = normalizeCity(filter.city).replace(/\s+/g, '-');
    const radius = filter.radiusKm ? `umkreis-${filter.radiusKm}km/` : '';

    const params = new URLSearchParams();
    params.set('categoryId', '203');

    if (filter.minPrice != null || filter.maxPrice != null) {
      params.set('priceType', 'FIXED');
      if (filter.minPrice != null) params.set('minPrice', String(filter.minPrice));
      if (filter.maxPrice != null) params.set('maxPrice', String(filter.maxPrice));
    }

    if (filter.minRooms != null) params.set('minRooms', String(filter.minRooms));
    if (filter.maxRooms != null) params.set('maxRooms', String(filter.maxRooms));

    return `${base}/${radius}${encodeURIComponent(city)}/k0?${params.toString()}`;
  }

  private async loadPage(url: string): Promise<string> {
    const userAgent =
      this.config.get<string>('SCRAPER_USER_AGENT') ??
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const delayMs = Number(this.config.get('SCRAPER_DELAY_MS') ?? 2000);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ userAgent });
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      // Close cookie banner if present
      try {
        await page.click('#gdpr-banner-accept', { timeout: 3_000 });
      } catch {
        // No banner — continue
      }

      await page.waitForSelector('article.aditem', { timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(delayMs);

      const html = await page.content();
      return html;
    } finally {
      await browser.close();
    }
  }

  private parseListings(html: string, filterCity: string): ScraperResult[] {
    const $ = cheerio.load(html);
    const results: ScraperResult[] = [];

    $('article.aditem').each((_, el) => {
      try {
        const item = $(el);

        // Extract ID and URL from link
        const link = item.find('a[href*="/s-anzeige/"]').first();
        const href = link.attr('href') ?? '';
        // Format: /s-anzeige/title/ID-203-CITYID
        const idMatch = href.match(/\/(\d+)-\d+-\d+$/);
        if (!idMatch) return;

        const externalId = idMatch[1];
        const url = `https://www.kleinanzeigen.de${href}`;

        // Title
        const title = item.find('h2 a.ellipsis').text().trim();
        if (!title) return;

        // Price
        const priceText = item.find('.aditem-main--middle--price-shipping--price').text().trim();
        const price = this.parsePrice(priceText);

        // Address (postal code + district)
        const address = item.find('.aditem-main--top--left').text().replace(/\s+/g, ' ').trim() || null;

        // Image
        const imgSrc = item.find('img').first().attr('src') ?? '';
        const images = imgSrc ? [imgSrc] : [];

        // Parse rooms/m² from title + description combined
        const searchText = `${title} ${item.find('.aditem-main--middle--description').text()}`;
        const rooms = this.parseRooms(searchText);
        const sizeM2 = this.parseSizeM2(searchText);

        results.push({
          externalId,
          title,
          price,
          rooms,
          sizeM2,
          address,
          city: filterCity,
          url,
          images,
        });
      } catch (err) {
        this.logger.warn(`Failed to parse listing: ${err}`);
      }
    });

    return results;
  }

  private parsePrice(text: string): number | null {
    const match = text.replace(/\./g, '').match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  private parseRooms(text: string): number | null {
    // "Einzimmerwohnung" = German compound for single-room apartment
    if (/\bEinzimmer/i.test(text)) return 1;
    // Matches: "2 Zimmer", "2-Zimmer", "2.5 Zimmer", "2 Zi.", "2 ZKB"
    const match = text.match(/(\d+[,.]?\d*)[\s-]*(Zimmer|Zi\.|ZKB)/i);
    if (!match) return null;
    return parseFloat(match[1].replace(',', '.'));
  }

  private parseSizeM2(text: string): number | null {
    // Matches: "65 m²", "65m²", "65 qm", "65qm", "65 m2"
    const match = text.match(/(\d+[,.]?\d*)\s*(m²|qm|m2)/i);
    if (!match) return null;
    return parseFloat(match[1].replace(',', '.'));
  }
}
