# Geliştirme Süreci

## Mevcut Durum (2026-04-21)

✅ **Tamamlananlar:**
- eBay Kleinanzeigen scraper (Playwright + Cheerio) — `article.aditem` selektörleri
- Matcher servisi — filter/listing eşleştirme, DB'ye kayıt
- WhatsApp bildirimleri (Twilio Sandbox) — test: 29 mesaj gönderildi
- Manuel trigger: `POST /api/scheduler/run`
- GitHub MCP bağlantısı

## Öncelik Sırası (Yarın)

1. **`check-matches.ts` ve debug dosyalarını temizle** — bunlar commit'e girdi
2. **rooms / sizeM2 parse** — şu an null, liste sayfasında yok → detay sayfası gerekebilir
3. **Stadt-normalisierung** — "München" vs "Muenchen" tutarsızlığı
4. **ImmoScout24, Immowelt, WG-Gesucht** scraper'ları
5. **Radius-Suche** — `radiusKm` henüz kullanılmıyor

## Bilinen Kısıtlamalar

- eBay Kleinanzeigen bot koruması → `SCRAPER_DELAY_MS` + gerçekçi User-Agent şart
- Twilio Sandbox: sadece onaylı numaralar (`join <code>` ile)
- SchedulerService Logger çalışmıyor (LOG seviyesi görünmüyor) — scraper ve DB çalışıyor, sadece log yok
- `check-matches.ts` debug dosyası repoya girdi — temizlenmeli

## Tekrarlayan Görevler

- Migration sonrası `npx prisma generate` çalıştır
- Yeni scraper eklerken `scrapers.module.ts` + `scheduler.service.ts` güncelle
- Platform enum değişirse `prisma/schema.prisma` + migration gerekli
- `.env` dosyası `backend/.env`'de (root `.env` kopyalanmış)

## Karar Günlüğü

| Tarih | Karar | Gerekçe |
|-------|-------|---------|
| 2026-04-21 | Playwright Option A seçildi | Bot tespitine karşı daha stabil |
| 2026-04-21 | `article.aditem` selektörü | `data-testid="listing-item"` eski, yeni site yapısı |
| 2026-04-21 | Twilio Sandbox ile test | Production öncesi onay gerekiyor |
