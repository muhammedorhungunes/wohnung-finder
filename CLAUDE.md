# Wohnung Finder — Claude Bağlamı

Alman konut ilanlarını (eBay Kleinanzeigen, ImmoScout24, Immowelt, WG-Gesucht) scrape edip kullanıcı filtrelerine göre WhatsApp (Twilio) bildirimi gönderen NestJS uygulaması.

## Tech Stack

- **Runtime:** Node.js 20+, TypeScript
- **Framework:** NestJS 10
- **ORM:** Prisma 5 → PostgreSQL (Docker)
- **Scraping:** Playwright + Cheerio
- **Cron:** `@nestjs/schedule` — 2 saatte bir
- **Alerts:** Twilio WhatsApp API

## Proje Yapısı

```
backend/src/
  app.module.ts
  main.ts
  prisma/              — PrismaService (singleton)
  modules/
    filters/           — CRUD (Filter modeli)
    listings/          — upsertMany, sorgular
    scrapers/          — EbayScraperService (Playwright+Cheerio; şu an placeholder)
    matcher/           — Listing ↔ Filter eşleştirme
    notifications/     — Twilio WhatsApp gönderimi
    scheduler/         — Cron orchestration
```

## Veritabanı Modelleri (Prisma)

- **Filter** — şehir, fiyat, oda, boyut, platformlar, whatsappNumber
- **Listing** — platform+externalId unique; title, price, rooms, sizeM2, url, images[]
- **Match** — filterId+listingId composite PK; notifiedAt ile bildirim takibi

## API Endpoints

- `GET/POST /api/filters`
- `GET /api/listings`

## Ortam Değişkenleri (.env)

```
DATABASE_URL=postgresql://wohnung:wohnung@localhost:5432/wohnung_finder
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
NODE_ENV=development
SCRAPER_USER_AGENT=...
SCRAPER_DELAY_MS=2000
```

## Geliştirme Komutları

```bash
docker compose up -d postgres          # DB başlat
cd backend && npm run start:dev        # Hot-reload dev server
npx prisma migrate dev                 # Migration oluştur/uygula
npx prisma studio                      # DB GUI
```

## Mevcut Durum

- eBay scraper placeholder — `fetchListings()` boş liste döndürüyor
- `buildSearchUrl`, `loadPage`, `parseListings` metodları henüz yazılmadı
- Diğer platformlar (ImmoScout, Immowelt, WG-Gesucht) scraper'ları yok
- E2E akış dökümantasyonu: `docs/E2E-EBAY-KLEINANZEIGEN.md`
