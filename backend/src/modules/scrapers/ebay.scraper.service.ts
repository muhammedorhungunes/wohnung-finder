import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { ListingsService } from '../listings/listings.service';
import { Platform, Filter } from '@prisma/client';

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

    this.logger.log(`${results.length} Inserate für Filter "${filter.name}" verarbeitet`);
    return results.length;
  }

  private async fetchListings(filter: Filter): Promise<ScraperResult[]> {
    const url = this.buildSearchUrl(filter);
    this.logger.debug(`Scraping URL: ${url}`);

    const html = await this.loadPage(url);
    const results = this.parseListings(html, filter.city);
    this.logger.debug(`Geparste Inserate: ${results.length}`);
    return results;
  }

  private buildSearchUrl(filter: Filter): string {
    const base = 'https://www.kleinanzeigen.de/s-wohnungen-suche';
    const city = encodeURIComponent(filter.city.toLowerCase().replace(/\s+/g, '-'));

    const params = new URLSearchParams();
    params.set('categoryId', '203');

    if (filter.minPrice || filter.maxPrice) {
      const min = filter.minPrice ?? '';
      const max = filter.maxPrice ?? '';
      params.set('priceType', 'FIXED');
      params.set('minPrice', String(min));
      params.set('maxPrice', String(max));
    }

    if (filter.minRooms) params.set('minRooms', String(filter.minRooms));
    if (filter.maxRooms) params.set('maxRooms', String(filter.maxRooms));
    if (filter.radiusKm) params.set('radius', String(filter.radiusKm));

    return `${base}/${city}/k0?${params.toString()}`;
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

      // Cookie-Banner schließen falls vorhanden
      try {
        await page.click('#gdpr-banner-accept', { timeout: 3_000 });
      } catch {
        // Kein Banner — weiter
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

        // ID + URL aus Link
        const link = item.find('a[href*="/s-anzeige/"]').first();
        const href = link.attr('href') ?? '';
        // Format: /s-anzeige/titel/ID-203-STADTID
        const idMatch = href.match(/\/(\d+)-\d+-\d+$/);
        if (!idMatch) return;

        const externalId = idMatch[1];
        const url = `https://www.kleinanzeigen.de${href}`;

        // Titel
        const title = item.find('h2 a.ellipsis').text().trim();
        if (!title) return;

        // Preis aus JSON-LD oder Text
        const jsonLd = item.find('script[type="application/ld+json"]').first().html() ?? '';
        let price: number | null = null;
        try {
          const data = JSON.parse(jsonLd);
          const priceText = item.find('.aditem-main--middle--price-shipping--price').text().trim();
          price = this.parsePrice(priceText);
        } catch {
          price = null;
        }

        // Adresse (PLZ + Stadtteil)
        const address = item.find('.aditem-main--top--left').text().replace(/\s+/g, ' ').trim() || null;

        // Bild
        const imgSrc = item.find('img').first().attr('src') ?? '';
        const images = imgSrc ? [imgSrc] : [];

        // Beschreibung für Zimmer/m²
        const descText = item.find('.aditem-main--middle--description').text();
        const rooms = this.parseRooms(descText);
        const sizeM2 = this.parseSizeM2(descText);

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
        this.logger.warn(`Inserat konnte nicht geparst werden: ${err}`);
      }
    });

    return results;
  }

  private parsePrice(text: string): number | null {
    const match = text.replace(/\./g, '').match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  private parseRooms(text: string): number | null {
    const match = text.match(/(\d+[,.]?\d*)\s*Zimmer/i);
    if (!match) return null;
    return parseFloat(match[1].replace(',', '.'));
  }

  private parseSizeM2(text: string): number | null {
    const match = text.match(/(\d+[,.]?\d*)\s*m²/i);
    if (!match) return null;
    return parseFloat(match[1].replace(',', '.'));
  }
}
