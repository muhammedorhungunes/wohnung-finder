import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium, Page } from 'playwright';
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

const MAX_DETAIL_FETCHES = 10;

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
    const listUrl = this.buildSearchUrl(filter);
    const userAgent =
      this.config.get<string>('SCRAPER_USER_AGENT') ??
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const delayMs = Number(this.config.get('SCRAPER_DELAY_MS') ?? 2000);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ userAgent });
    const page = await context.newPage();

    try {
      const listHtml = await this.navigateAndGetHtml(page, listUrl, 'article.aditem', delayMs);
      const results = this.parseListings(listHtml, filter.city);

      // Enrich listings missing rooms/sizeM2 from detail pages
      let detailFetches = 0;
      for (const result of results) {
        if (result.rooms !== null && result.sizeM2 !== null) continue;
        if (detailFetches >= MAX_DETAIL_FETCHES) break;

        await page.waitForTimeout(delayMs);
        const detailHtml = await this.navigateAndGetHtml(page, result.url, '#viewad-details', delayMs);
        const { rooms, sizeM2 } = this.parseDetailPage(detailHtml);

        if (result.rooms === null) result.rooms = rooms;
        if (result.sizeM2 === null) result.sizeM2 = sizeM2;
        detailFetches++;
      }

      this.logger.debug(`Detail pages fetched: ${detailFetches}`);
      return results;
    } finally {
      await browser.close();
    }
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

  private async navigateAndGetHtml(page: Page, url: string, waitSelector: string, delayMs: number): Promise<string> {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    try {
      await page.click('#gdpr-banner-accept', { timeout: 3_000 });
    } catch {
      // No banner — continue
    }

    await page.waitForSelector(waitSelector, { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(delayMs);

    return page.content();
  }

  private parseListings(html: string, filterCity: string): ScraperResult[] {
    const $ = cheerio.load(html);
    const results: ScraperResult[] = [];

    $('article.aditem').each((_, el) => {
      try {
        const item = $(el);

        const link = item.find('a[href*="/s-anzeige/"]').first();
        const href = link.attr('href') ?? '';
        const idMatch = href.match(/\/(\d+)-\d+-\d+$/);
        if (!idMatch) return;

        const externalId = idMatch[1];
        const url = `https://www.kleinanzeigen.de${href}`;

        const title = item.find('h2 a.ellipsis').text().trim();
        if (!title) return;

        const priceText = item.find('.aditem-main--middle--price-shipping--price').text().trim();
        const price = this.parsePrice(priceText);

        const address = item.find('.aditem-main--top--left').text().replace(/\s+/g, ' ').trim() || null;

        const imgSrc = item.find('img').first().attr('src') ?? '';
        const images = imgSrc ? [imgSrc] : [];

        const searchText = `${title} ${item.find('.aditem-main--middle--description').text()}`;
        const rooms = this.parseRooms(searchText);
        const sizeM2 = this.parseSizeM2(searchText);

        results.push({ externalId, title, price, rooms, sizeM2, address, city: filterCity, url, images });
      } catch (err) {
        this.logger.warn(`Failed to parse listing: ${err}`);
      }
    });

    return results;
  }

  private parseDetailPage(html: string): { rooms: number | null; sizeM2: number | null } {
    const $ = cheerio.load(html);
    let rooms: number | null = null;
    let sizeM2: number | null = null;

    $('#viewad-details li').each((_, el) => {
      const label = $(el).find('.addetailslist--detail--title').text().trim().toLowerCase();
      const value = $(el).find('.addetailslist--detail--value').text().trim();

      if (label.includes('zimmer')) {
        const parsed = parseFloat(value.replace(',', '.'));
        if (!isNaN(parsed)) rooms = parsed;
      }

      if (label.includes('wohnfläche') || label.includes('nutzfläche')) {
        const parsed = parseFloat(value.replace(/[^\d,.]/g, '').replace(',', '.'));
        if (!isNaN(parsed)) sizeM2 = parsed;
      }
    });

    // Fallback: try regex on full page text if structured data not found
    if (rooms === null || sizeM2 === null) {
      const pageText = $('body').text();
      if (rooms === null) rooms = this.parseRooms(pageText);
      if (sizeM2 === null) sizeM2 = this.parseSizeM2(pageText);
    }

    return { rooms, sizeM2 };
  }

  private parsePrice(text: string): number | null {
    const match = text.replace(/\./g, '').match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  private parseRooms(text: string): number | null {
    if (/\bEinzimmer/i.test(text)) return 1;
    const match = text.match(/(\d+[,.]?\d*)[\s-]*(Zimmer|Zi\.|ZKB)/i);
    if (!match) return null;
    return parseFloat(match[1].replace(',', '.'));
  }

  private parseSizeM2(text: string): number | null {
    const match = text.match(/(\d+[,.]?\d*)\s*(m²|qm|m2)/i);
    if (!match) return null;
    return parseFloat(match[1].replace(',', '.'));
  }
}
