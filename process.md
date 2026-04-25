# Geliştirme Süreci

## Mevcut Durum (2026-04-26)

✅ **Tamamlananlar:**
- eBay Kleinanzeigen scraper (Playwright + Cheerio) — `article.aditem` selektörleri
- Matcher servisi — filter/listing eşleştirme, score hesaplama (0–100)
- Gmail/nodemailer bildirimleri — HTML digest e-posta, Top-5 eşleşme
- Manuel trigger: `POST /api/scheduler/run`
- WhatsApp/Twilio → Gmail/nodemailer geçişi tamamlandı
- `check-matches.ts` debug dosyası temizlendi

## Öncelik Sırası

1. **rooms / sizeM2 parse** — şu an null geliyor, liste sayfasında yok → detay sayfası gerekebilir
2. **Stadt-normalisierung** — "München" vs "Muenchen" tutarsızlığı
3. **ImmoScout24, Immowelt, WG-Gesucht** scraper'ları
4. **Radius-Suche** — `radiusKm` Filter'da var ama henüz kullanılmıyor

## Bilinen Kısıtlamalar

- eBay Kleinanzeigen bot koruması → `SCRAPER_DELAY_MS` + gerçekçi User-Agent şart
- Gmail: App Password gerekiyor (`GMAIL_USER` + `GMAIL_APP_PASSWORD` env vars)
- SchedulerService Logger çalışmıyor (LOG seviyesi görünmüyor) — scraper ve DB çalışıyor

## Ortam Değişkenleri

```
DATABASE_URL=postgresql://wohnung:wohnung@localhost:5432/wohnung_finder
GMAIL_USER=...@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
NODE_ENV=development
SCRAPER_USER_AGENT=...
SCRAPER_DELAY_MS=2000
```

## Tekrarlayan Görevler

- Migration sonrası `npx prisma generate` çalıştır
- Yeni scraper eklerken `scrapers.module.ts` + `scheduler.service.ts` güncelle
- Platform enum değişirse `prisma/schema.prisma` + migration gerekli
- `.env` dosyası `backend/.env`'de

## Karar Günlüğü

| Tarih | Karar | Gerekçe |
|-------|-------|---------|
| 2026-04-21 | Playwright Option A seçildi | Bot tespitine karşı daha stabil |
| 2026-04-21 | `article.aditem` selektörü | `data-testid="listing-item"` eski, yeni site yapısı |
| 2026-04-26 | Twilio → Gmail/nodemailer | Twilio Sandbox kısıtlaması, Gmail daha kolay test |
