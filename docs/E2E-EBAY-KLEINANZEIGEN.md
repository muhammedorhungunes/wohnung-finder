# eBay Kleinanzeigen — Uçtan Uca Senaryo

Bu dokümanda, tek platform (eBay Kleinanzeigen) ile akışın baştan sona nasıl işlediği adım adım anlatılıyor. Cron aralığı **2 saat** olarak kabul edilmiştir.

---

## 1. Kullanıcı Perspektifi (Senaryo)

1. **Kullanıcı filtre oluşturur**
   - Şehir: **München**
   - Fiyat: 800€ – 1.400€
   - Oda: 2–4
   - Platform: sadece **eBay Kleinanzeigen**
   - WhatsApp numarası: +49…

2. **Sistem 2 saatte bir çalışır**
   - eBay Kleinanzeigen’de München + fiyat/oda kriterlerine uygun arama sayfası taranır.
   - Yeni ilanlar (daha önce `listings` tablosunda olmayan `external_id`’ler) kaydedilir.
   - Her yeni ilan, aktif filtrelerle eşleştirilir; bu filtreye uyuyorsa bir **match** oluşturulur.
   - Eşleşen ilanlar için kullanıcının WhatsApp’ına mesaj gider; `matches.notified_at` güncellenir.

3. **Kullanıcı bildirim alır**
   - WhatsApp’ta örnek mesaj:
   - "🏠 Yeni İlan — eBay Kleinanzeigen — [Başlık] — [Fiyat] — [Link] — Filter: München 2–4 Zimmer"

---

## 2. Teknik Akış (Sırayla)

### 2.1. Filtre kaydı (API)

- **POST /filters** ile yeni filter oluşturulur.
- Body örneği:
  ```json
  {
    "name": "München 2-4 Zimmer",
    "city": "München",
    "minPrice": 800,
    "maxPrice": 1400,
    "minRooms": 2,
    "maxRooms": 4,
    "platforms": ["EBAY"],
    "whatsappNumber": "+49..."
  }
  ```
- Kayıt `filters` tablosuna yazılır; `is_active = true`.

---

### 2.2. Cron tetiklenir (her 2 saatte bir)

- **Scheduler** (Nest `@Cron('0 */2 * * *')`) çalışır.
- Aktif filtreler çekilir: `filters` where `is_active = true`.
- Her filtre için `platforms` içinde `EBAY` varsa eBay Kleinanzeigen scraper’ı çağrılır.

---

### 2.3. eBay Kleinanzeigen scraper

- **Girdi:** Filter entity (city, minPrice, maxPrice, minRooms, maxRooms).
- **İşlem:**
  - eBay Kleinanzeigen arama URL’i oluşturulur (şehir + fiyat/oda parametreleri).
  - Playwright ile sayfa açılır; HTML alınır.
  - Cheerio ile liste parse edilir: her ilan için `external_id`, `title`, `price`, `rooms`, `url`, `address` vb. çıkarılır.
  - Her ilan için **upsert** yapılır: `(platform, external_id)` unique; yoksa insert, varsa güncelleme (fiyat/başlık değişmiş olabilir).
- **Çıktı:** Yeni eklenen veya güncellenen `listings` kayıtları (veya en azından “işlendi” bilgisi).

---

### 2.4. Matcher

- Son cron turunda **yeni giren veya güncellenen** listing’ler için (ör. `first_seen_at` veya `updated_at` bu turda değişenler) eşleştirme yapılır.
- İlgili filtreler: aynı platform + şehir/fiyat/oda aralığına uyanlar.
- Her (filter, listing) çifti için:
  - Şehir eşleşiyor mu?
  - `min_price <= price <= max_price`
  - `min_rooms <= rooms <= max_rooms` (null-safe)
  - `matches` tablosunda `(filter_id, listing_id)` zaten var mı? Yoksa yeni satır eklenir; `notified_at = null`.

---

### 2.5. Bildirim (WhatsApp)

- `matches` tablosunda `notified_at IS NULL` olan kayıtlar seçilir.
- Her kayıt için ilgili filter’ın `whatsapp_number`’ı alınır.
- Twilio WhatsApp API ile mesaj metni gönderilir.
- Başarılıysa ilgili `matches.notified_at` güncellenir; böylece aynı eşleşme tekrar gönderilmez.

---

## 3. Veri Akışı Özeti

```
[POST /filters] → filters tablosu
                        ↓
[Cron 0 */2 * * *] → Aktif filtreler
                        ↓
                 eBay Scraper (Playwright + Cheerio)
                        ↓
                 listings (upsert by platform + external_id)
                        ↓
                 Matcher (yeni listing × uygun filtreler)
                        ↓
                 matches (filter_id, listing_id, notified_at = null)
                        ↓
                 Twilio WhatsApp → matches.notified_at güncelle
```

---

## 4. Idempotency ve Tekrar Çalışma

- **Listings:** Aynı `(platform, external_id)` tekrar scrape edilirse sadece update; yeni satır eklenmez.
- **Matches:** `(filter_id, listing_id)` unique; aynı çift tekrar match edilmez.
- **Notifications:** Sadece `notified_at IS NULL` olanlar gönderilir; gönderim sonrası `notified_at` set edilir.

Böylece cron 2 saatte bir güvenle tekrar çalışabilir; aynı ilan için çift bildirim gitmez.
