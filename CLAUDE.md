# wohnung-finder

NestJS backend that scrapes German apartment listings, matches them against user-defined filters, and sends Gmail digest emails.

## Tech Stack

- **Runtime:** Node.js + NestJS (TypeScript)
- **Database:** PostgreSQL via Prisma ORM
- **Scraping:** Playwright (headless browser) + Cheerio (HTML parsing)
- **Email:** nodemailer with Gmail SMTP
- **Scheduling:** `@nestjs/schedule` cron

## Architecture

```
FiltersService       — CRUD for user search filters (city, price, rooms, size)
EbayScraperService   — Playwright → Cheerio → upsert into Listing table
MatcherService       — cross-joins Listings × Filters, scores 0–100, writes Match rows
NotificationsService — groups pending Matches by filter, sends HTML digest email (top 5)
SchedulerService     — orchestrates the above every 2h via @Cron; manual trigger via POST /api/scheduler/run
```

## E2E Data Flow

```
POST /api/scheduler/run
  → FiltersService.findActive()
  → EbayScraperService.fetchAndUpsert(filter)   # per active filter
  → MatcherService.matchNewListings()
  → NotificationsService.sendPendingMatches()   # marks Match.notifiedAt
```

## Prisma Models

| Model | Key fields |
|-------|-----------|
| `Filter` | city, radiusKm, minPrice, maxPrice, minRooms, maxRooms, minSizeM2, platforms[], isActive, email |
| `Listing` | platform, externalId (unique), title, price, rooms, sizeM2, city, url, images[] |
| `Match` | (filterId, listingId) composite PK, score, notifiedAt |

Score breakdown: price 0–40 pts, rooms 0–30 pts, recency 0–30 pts.

## Environment Variables

File: `backend/.env`

```
DATABASE_URL=postgresql://wohnung:wohnung@localhost:5432/wohnung_finder
GMAIL_USER=...@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   # Google App Password, not account password
NODE_ENV=development
SCRAPER_USER_AGENT=...
SCRAPER_DELAY_MS=2000
```

## Development

```bash
cd backend
docker compose up -d          # PostgreSQL
npm run start:dev             # NestJS dev server on :3000

# Manual trigger
curl -X POST http://localhost:3000/api/scheduler/run
```

After any Prisma schema change:
```bash
npx prisma migrate dev
npx prisma generate
```

## Adding a New Scraper

1. Create `backend/src/modules/scrapers/<platform>.scraper.service.ts` — implement `fetchAndUpsert(filter: Filter): Promise<number>`
2. Add the service to `scrapers.module.ts` (providers + exports)
3. Inject and call it in `scheduler.service.ts` inside `handleScrapeAndNotify()`
4. Add the platform value to `prisma/schema.prisma` `Platform` enum → migrate

## Known Constraints

- **Bot protection:** eBay Kleinanzeigen blocks fast requests. Keep `SCRAPER_DELAY_MS` ≥ 2000 and use a realistic User-Agent.
- **Gmail App Password required:** standard Google account password won't work. Generate at myaccount.google.com → Security → App Passwords.
- **SchedulerService Logger:** log output may not appear in dev console — scraper and DB operations still run correctly.
- **rooms / sizeM2:** currently `null` on most listings — eBay list page doesn't expose them, detail page scraping not yet implemented.
- **radiusKm filter field** exists in schema but is not yet used in matcher logic.

## Active Priorities

1. Add ImmoScout24, Immowelt, WG-Gesucht scrapers
