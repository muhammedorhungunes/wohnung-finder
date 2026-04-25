# Wohnung Finder

Automatische Wohnungssuche: Scrapet Anzeigen von eBay Kleinanzeigen (und weiteren Plattformen), vergleicht sie mit deinen Filtern und schickt dir eine E-Mail mit den **Top 3–5 besten Treffern** — sortiert nach Relevanz-Score.

## Tech Stack

| Bereich | Technologie |
|---------|-------------|
| Backend | Node.js 20 + NestJS 10 |
| Datenbank | PostgreSQL (Docker) |
| ORM | Prisma 5 |
| Scraping | Playwright + Cheerio |
| Scheduler | `@nestjs/schedule` — alle 2 Stunden |
| Benachrichtigungen | Nodemailer + Gmail SMTP |

## Voraussetzungen

- Node.js 20+
- Docker (für PostgreSQL)
- Gmail-Konto mit [App-Passwort](https://myaccount.google.com/apppasswords)

## Installation

### 1. Umgebungsvariablen konfigurieren

```bash
cp .env.example .env
```

Folgende Werte in `.env` eintragen:

```env
DATABASE_URL=postgresql://wohnung:wohnung@localhost:5432/wohnung_finder

GMAIL_USER=deine@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

### 2. Datenbank starten

```bash
docker compose up -d postgres
```

### 3. Backend starten

```bash
cd backend
npm install
npx prisma migrate deploy
npm run start:dev
```

API erreichbar unter: `http://localhost:3000/api`

## API-Endpunkte

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| `GET` | `/api/filters` | Alle Filter auflisten |
| `POST` | `/api/filters` | Neuen Filter erstellen |
| `PATCH` | `/api/filters/:id` | Filter aktualisieren |
| `PATCH` | `/api/filters/:id/toggle` | Filter aktivieren/deaktivieren |
| `GET` | `/api/listings` | Gefundene Anzeigen |
| `POST` | `/api/scheduler/run` | Suche manuell starten |

### Filter erstellen (Beispiel)

```json
POST /api/filters
{
  "name": "München 2-Zimmer",
  "city": "München",
  "maxPrice": 1200,
  "minRooms": 2,
  "maxRooms": 3,
  "email": "deine@gmail.com",
  "platforms": ["EBAY"]
}
```

## Wie es funktioniert

1. **Scraper** lädt alle 2 Stunden neue Anzeigen von eBay Kleinanzeigen
2. **Matcher** vergleicht Anzeigen mit aktiven Filtern (Preis, Zimmer, Stadt, Größe)
3. **Scoring** bewertet jeden Treffer (0–100 Punkte):
   - Preisvorteil (bis 40 Pkt.) — je günstiger im Budget, desto besser
   - Zimmer-Treffer (bis 30 Pkt.) — je näher an der Mitte des Bereichs
   - Aktualität (bis 30 Pkt.) — < 24h = volle Punkte
4. **E-Mail** wird mit den Top 5 Treffern als übersichtliche HTML-Digest gesendet

## Datenbankmodelle

- **filters** — Suchfilter (Stadt, Preis, Zimmer, Plattformen, E-Mail-Adresse)
- **listings** — Gefundene Anzeigen (platform + external_id eindeutig)
- **matches** — Welcher Filter hat welche Anzeige gefunden; `score` und `notified_at` für die Benachrichtigung

## Entwicklungskommandos

```bash
# Datenbankoberfläche
npx prisma studio

# Migration erstellen
npx prisma migrate dev --name beschreibung

# Nach Schemaänderung
npx prisma generate
```
