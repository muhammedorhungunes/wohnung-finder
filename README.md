# Wohnung Finder

Automated apartment search: scrapes listings from eBay Kleinanzeigen (and more platforms), matches them against your filters, and sends you an email with the **top 3–5 best matches** — sorted by relevance score.

## Tech Stack

| Area | Technology |
|------|------------|
| Backend | Node.js 20 + NestJS 10 |
| Database | PostgreSQL (Docker) |
| ORM | Prisma 5 |
| Scraping | Playwright + Cheerio |
| Scheduler | `@nestjs/schedule` — every 2 hours |
| Notifications | Nodemailer + Gmail SMTP |

## Prerequisites

- Node.js 20+
- Docker (for PostgreSQL)
- Gmail account with an [App Password](https://myaccount.google.com/apppasswords)

## Setup

### 1. Configure environment variables

```bash
cp .env.example .env
```

Fill in the following values in `.env`:

```env
DATABASE_URL=postgresql://wohnung:wohnung@localhost:5432/wohnung_finder

GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

### 2. Start the database

```bash
docker compose up -d postgres
```

### 3. Start the backend

```bash
cd backend
npm install
npx prisma migrate deploy
npm run start:dev
```

API available at: `http://localhost:3000/api`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/filters` | List all filters |
| `POST` | `/api/filters` | Create a new filter |
| `PATCH` | `/api/filters/:id` | Update a filter |
| `PATCH` | `/api/filters/:id/toggle` | Enable/disable a filter |
| `GET` | `/api/listings` | View scraped listings |
| `POST` | `/api/scheduler/run` | Manually trigger a scrape run |

### Create a filter (example)

```json
POST /api/filters
{
  "name": "Munich 2-room",
  "city": "München",
  "maxPrice": 1200,
  "minRooms": 2,
  "maxRooms": 3,
  "email": "your@gmail.com",
  "platforms": ["EBAY"]
}
```

## How it works

1. **Scraper** fetches new listings from eBay Kleinanzeigen every 2 hours
2. **Matcher** compares listings against active filters (price, rooms, city, size)
3. **Scoring** rates each match from 0–100:
   - Price advantage (up to 40 pts) — cheaper within budget = higher score
   - Room match (up to 30 pts) — closer to the midpoint of the range = higher score
   - Recency (up to 30 pts) — < 24h = full points
4. **Email** sends the top 5 matches as a clean HTML digest

## Database models

- **filters** — search filters (city, price, rooms, platforms, email)
- **listings** — scraped listings (platform + external_id unique)
- **matches** — which filter matched which listing; `score` and `notified_at` track notifications

## Development commands

```bash
# Database GUI
npx prisma studio

# Create a migration
npx prisma migrate dev --name description

# After schema changes
npx prisma generate
```
