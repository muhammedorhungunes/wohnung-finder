# Wohnung Finder

Wohnung ilanlarını (WG-Gesucht, ImmoScout24, eBay Kleinanzeigen, Immowelt) tarayıp, kaydettiğin filtreye göre yeni ilan gelince WhatsApp (Twilio) ile bildiren uygulama.

## Tech Stack

- **Backend:** Node.js + NestJS
- **DB:** PostgreSQL (Docker)
- **ORM:** Prisma
- **Scraping:** Playwright + Cheerio (eBay Kleinanzeigen ile başlanıyor)
- **Scheduler:** 2 saatte bir cron (`@nestjs/schedule`)
- **Alerts:** Twilio WhatsApp API

## Gereksinimler

- Node.js 18+ (tercihen 20+)
- Docker (Postgres için)

## Kurulum

1. **Postgres'ı başlat**
   ```bash
   cp .env.example .env
   # .env içinde DATABASE_URL ve Twilio bilgilerini doldur
   docker compose up -d postgres
   ```

2. **Backend**
   ```bash
   cd backend
   npm install
   npx prisma generate
   npx prisma migrate deploy
   npm run start:dev
   ```

3. API: `http://localhost:3000/api`
   - `GET/POST /api/filters`
   - `GET /api/listings`

## Veritabanı

- **filters:** Kullanıcı filtreleri (şehir, fiyat, oda, platformlar, WhatsApp numarası)
- **listings:** Scrape edilen ilanlar (platform + external_id unique)
- **matches:** Hangi filtre hangi ilanı gördü; `notified_at` ile WhatsApp gönderimi takibi

## Senaryo

eBay Kleinanzeigen için uçtan uca akış: `docs/E2E-EBAY-KLEINANZEIGEN.md`
