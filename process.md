# Geliştirme Süreci

## Öncelik Sırası

1. **eBay Kleinanzeigen scraper** — `EbayScraperService.fetchListings()` implement et
   - `buildSearchUrl(filter)` → URL oluştur
   - `loadPage(url)` → Playwright ile sayfa yükle
   - `parseListings(html)` → Cheerio ile ilan parse et
2. **Matcher servisi** — scrape sonrası filtre eşleştirme logic'i
3. **Notifications** — Twilio entegrasyonu tamamla
4. **Diğer platformlar** — ImmoScout24, Immowelt, WG-Gesucht

## Bilinen Kısıtlamalar

- eBay Kleinanzeigen bot koruması var → `SCRAPER_DELAY_MS` + gerçekçi User-Agent şart
- Playwright headless modda tespit edilebilir; gerekirse `headless: false` veya stealth plugin
- Twilio sandbox'ta sadece onaylı numaralar çalışır

## Karar Günlüğü

| Tarih | Karar | Gerekçe |
|-------|-------|---------|
| 2026-04-20 | eBay scraper placeholder bırakıldı | Playwright entegrasyonu bot tespiti riski taşıyor, önce URL/parse mantığı netleştirilecek |

## Tekrarlayan Görevler

- Migration sonrası `npx prisma generate` çalıştır
- Yeni scraper eklerken `scrapers.module.ts` + `scheduler.service.ts` güncelle
- Platform enum değişirse `prisma/schema.prisma` + migration gerekli
