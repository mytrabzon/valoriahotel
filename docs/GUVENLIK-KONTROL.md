# Valoria Hotel – Uygulama güvenlik kontrolü

Bu belge, uygulama güvenliği kontrolünde tespit edilen noktaları ve yapılan iyileştirmeleri özetler.

---

## Yapılan düzeltmeler

### 1. **Kritik: Misafir app_token RPC’leri (e-posta ile token sızıntısı)**

**Sorun:** `get_guest_app_token_by_email(p_email)` ve `get_or_create_guest_app_token_by_email(p_email, p_full_name)` fonksiyonları, çağıran kullanıcının JWT’deki e-postasını kontrol etmiyordu. Herhangi bir giriş yapmış kullanıcı başka bir e-posta ile RPC çağırarak o misafirin `app_token`’ını alabiliyordu (mesajlaşmada kimlik taklidi riski).

**Çözüm:** Migration `028_guest_app_token_rpc_caller_email_check.sql` eklendi. Her iki RPC artık sadece `auth.jwt() ->> 'email'` ile eşleşen `p_email` için token döndürüyor/döndürüp oluşturuyor; aksi durumda `NULL` dönüyor.

**Uygulama:** Migration’ı çalıştırın:
```bash
supabase db push
# veya
supabase migration up
```

---

### 2. **Müşteri alanı route koruması**

**Sorun:** `/customer` layout’u giriş kontrolü yapmıyordu; doğrudan URL ile (özellikle web’de) giriş yapmamış kullanıcı müşteri ekranlarına düşebiliyordu.

**Çözüm:** `app/customer/_layout.tsx` güncellendi. Giriş yapmamış kullanıcı (`!user`) anasayfaya (`/`), personel hesabı olan kullanıcı (`staff`) ise `/staff`’a yönlendiriliyor.

---

## Güçlü yönler (değişiklik yapılmadı)

- **Kimlik doğrulama:** Supabase Auth kullanılıyor; oturum AsyncStorage’da saklanıyor, token yenileme açık.
- **Admin/Personel koruması:** `app/admin/_layout.tsx` ve `app/staff/_layout.tsx` sadece ilgili rol/oturum varken içeriği gösteriyor; admin için `staff.role === 'admin'` kontrolü var.
- **Edge Functions:** `create-staff`, `approve-staff-application`, `update-staff` JWT doğrulayıp admin kontrolü yapıyor; `service_role` sadece sunucu tarafında (Edge Functions) kullanılıyor, istemcide yok.
- **RLS:** Staff, mesajlaşma, conversation_participants vb. için RLS politikaları tanımlı; recursion düzeltmeleri (SECURITY DEFINER fonksiyonlar) mevcut.
- **Hassas veri:** Şifreler ve access token’lar loglara yazılmıyor; `EXPO_PUBLIC_*` ile sadece anon key ve URL client’ta (RLS ile veri korunuyor).
- **Medya yükleme:** `upload-message-media` Edge Function’da `app_token` ile misafir doğrulanıyor ve konuşma katılımı kontrol ediliyor.

---

## Öneriler (ileride yapılabilecekler)

1. **SOLE_ADMIN_UID / e-posta:** `constants/soleAdmin.ts` içinde tek admin UID ve e-posta sabit. Bu bilgi repo’da kalabilir; asıl yetki veritabanı ve RLS ile belirleniyor. İsterseniz bu sabiti env’e taşıyabilirsiniz.
2. **Storage bucket’lar:** `stock-proofs` ve `profiles` public okuma; yükleme authenticated. İleride okumayı da authenticated veya role göre kısıtlayabilirsiniz.
3. **CORS:** Edge Functions’da `Access-Control-Allow-Origin: "*"` kullanılıyor. Prod’da mümkünse belirli origin’lere kısıtlayın.
4. **Şifre politikası:** Kayıt ve personel şifresi için minimum 6 karakter var; isteğe bağlı olarak büyük/küçük harf, rakam ve özel karakter zorunluluğu eklenebilir.
5. **Rate limiting:** Magic link ve şifre girişi için Supabase tarafında rate limit ayarlarını kontrol edin; gerekirse ek throttle ekleyin.

---

## Özet

| Alan              | Durum        | Not |
|-------------------|-------------|-----|
| Auth & session    | Güçlü       | Supabase Auth, layout’larda yönlendirme |
| Admin/Staff guard | Güçlü       | Layout + Edge Function admin kontrolü |
| Customer guard    | Düzeltildi  | Layout’a guard eklendi |
| Guest token RPC   | Düzeltildi  | Migration 028 ile sadece kendi e-postası |
| RLS               | Güçlü       | Tablolarda politikalar, recursion düzeltmeleri |
| Service role      | Güvenli     | Sadece Edge Functions’da |
| Logging           | Güvenli     | Şifre/token loglanmıyor |

Güvenlik kontrolü tamamlandı; kritik RPC açığı kapatıldı ve müşteri route’u korundu.
