# 🚀 Valoria Hotel – Yapılacaklar Yol Haritası

## Mevcut Durum (Faz 1 – Tamamlandı)

| Özellik | Durum |
|--------|--------|
| Misafir akışı | QR → Dil → Sözleşme → Form → **SMS** doğrulama → İmza → Başarı |
| Admin paneli | Giriş, odalar, misafirler, check-in/out, sözleşme şablonları |
| Oda QR kodları | Dinamik token, yenileme |
| verification_codes | Tabloda `channel`: `'whatsapp' \| 'sms'` **hazır** (uygulama şu an sadece SMS kullanıyor) |

---

## 1. HEMEN YAPILABİLECEKLER (Çok Kolay)

| # | Özellik | Ne yapılacak | Proje durumu |
|---|--------|--------------|--------------|
| 1 | **PDF sözleşme çıktı** | Onaylanan sözleşmeyi PDF olarak indir / e-posta ile gönder | Guest + contract verisi var; React Native’de PDF (expo-print veya react-native-pdf) ile sayfa oluşturup paylaş. |
| 2 | **Oda durumu (Housekeeping)** | Temizlik/bakım ekranı: oda listesi, durum (temizlik/bakım/bitti) güncelleme | `rooms.status` zaten var: `cleaning`, `maintenance`, `available`… Sadece admin’e “Oda Durumu” ekranı + filtre/güncelleme. |
| 3 | **Günlük rapor (Excel)** | Doluluk oranı, check-in/out sayısı, Excel/CSV çıktı | Supabase’den tarih aralığına göre sorgu; CSV export (admin ekranı veya Edge Function). |
| 4 | **E-posta bildirim** | Check-in sonrası otomatik “Hoş geldiniz” e-postası | Supabase Edge Function veya trigger: guest `status` → `checked_in` olunca Resend/SendGrid ile mail at. |
| 5 | **WhatsApp doğrulama** | SMS yerine/alternatif WhatsApp ile kod gönderme | Veritabanı hazır; WhatsApp Business API veya Twilio/Evolution API ile kod gönder; `verify.tsx`’te kanal seçimi (SMS/WhatsApp). |
| 6 | **Müşteri uygulaması (otel içi)** | Telefonla giriş, oda servisi, temizlik talebi, ek hizmetler | Yeni akış: misafir check-in sonrası “Misafir Girişi” (oda no + soyad/telefon ile doğrulama) → menü: oda servisi, temizlik talebi, iletişim. |

**Önerilen ilk sıra:** PDF sözleşme → Oda durumu (Housekeeping) → Günlük rapor → E-posta bildirim → WhatsApp doğrulama → Müşteri uygulaması.

---

## 2. ORTA ZORLUKTA OLANLAR

| # | Özellik | Kısa not |
|---|--------|----------|
| 1 | **Push bildirim** | “Odanız hazır”, admin onayı, özel teklifler → Expo Notifications + FCM/APNs; guest’e device token kaydet. |
| 2 | **Sadakat puan** | Her konaklamada puan, indirim → `guests` veya ayrı `loyalty_accounts` tablosu, puan kuralları. |
| 3 | **Online ödeme** | Depozito/ödeme → Stripe veya yerel ödeme altyapısı; güvenli kart saklama. |
| 4 | **QR ile kapı açma** | Akıllı kilit API’si ile entegrasyon; mevcut QR token veya zamanlı PIN. |
| 5 | **Personel mesajlaşma** | Chat + görev atama → `staff`, `chat_rooms`, `messages`, görev tablosu. |

---

## 3. İLERİ SEVİYE

| Özellik | Not |
|--------|-----|
| PMS entegrasyonu | Opera, Otellio vb. – API senkronizasyonu |
| Muhasebe entegrasyonu | Fatura otomasyonu |
| Oda kontrol sistemi | Işık, perde, klima – IoT/API |
| Yüz tanıma | Opsiyonel check-in |
| Çoklu otel | Zincir oteller için multi-tenant şema |

---

## 🎯 En Çok İstenen × Zorluk (Özet)

| Özellik | İşe yarar | Zorluk | Önerilen sıra |
|--------|------------|--------|----------------|
| Müşteri uygulaması | Oda servisi, temizlik, ek hizmetler | ⭐⭐ | 1. kolay grubun sonunda |
| WhatsApp doğrulama | SMS alternatifi | ⭐ | 1. kolay grubunda |
| PDF sözleşme | İndir / maile gönder | ⭐ | **İlk yapılacak** |
| Push bildirim | “Odanız hazır” vb. | ⭐⭐ | 2. orta grupta |
| QR kapı açma | Telefonla odaya giriş | ⭐⭐⭐ | Orta/ileri |
| Sadakat puanı | Tekrar gelen müşteri | ⭐⭐ | Orta grupta |

---

## Sonraki Adım (Teknik)

Hangisiyle başlamak istersiniz?

1. **PDF sözleşme** – Misafir detay ekranında “PDF İndir” butonu + sözleşme metni + imza görseli.
2. **Oda durumu (Housekeeping)** – Admin’e “Oda Durumu” menüsü, oda listesi, durum dropdown (available / cleaning / maintenance / out_of_order).
3. **Günlük rapor** – Tarih seçimi + CSV/Excel indirme (doluluk, giriş-çıkış sayıları).

Bu üçünden birini seçerseniz, bir sonraki mesajda o özellik için doğrudan kod tarafında yapılacak değişiklikleri (eklenecek dosyalar, API, migration ihtiyacı) adım adım yazabilirim.
