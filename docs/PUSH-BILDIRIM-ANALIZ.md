# Push Bildirim Neden Gelmiyor – Analiz

## Akış özeti

1. **Token alımı:** `getExpoPushTokenAsync()` izin ister, Expo push token döner, `AsyncStorage`'a yazılır.
2. **Backend’e kayıt:** `savePushTokenForStaff(staffId)` veya `savePushTokenForGuest(appToken)` token’ı `push_tokens` tablosuna yazar.
3. **Gönderim:** `send-expo-push` edge function’ı `push_tokens`’tan token’ları okuyup Expo API’ye push gönderir.

---

## Tespit edilen nedenler

### 1. Token hiç alınmamış / kaydedilmemiş (en olası)

- **authStore** (`loadSession` sonrası): Sadece `savePushTokenForStaff(staff.id)` çağrılıyor.  
  `savePushTokenForStaff` içinde **sadece** `getStoredExpoPushToken()` kullanılıyor; **izin isteyip token alan** `getExpoPushTokenAsync()` çağrılmıyor.  
  İlk açılışta AsyncStorage’ta token olmadığı için bu kayıt **hiçbir şey yapmıyor**.

- **Root layout** (staff varsa): `getExpoPushTokenAsync()` çağrılıyor, sonra token varsa `savePushTokenForStaff()`.  
  Bu noktada izin verilmemişse token `null` döner, tekrar deneme yapılmıyor.  
  Token ancak **Bildirimler** sekmesi açıldığında tekrar deneniyor (orada tekrar `getExpoPushTokenAsync()` + `savePushTokenForStaff` var).

**Sonuç:** Kullanıcı bildirim iznini ilk seferde vermezse veya root layout’taki çağrı izin penceresinden önce/sonra yanlış zamanda çalışırsa token hiç backend’e yazılmıyor → push gelmez.

### 2. Expo Go kullanımı

- `isExpoGo === true` ise `getExpoPushTokenAsync()` ve `savePushTokenForStaff` çalışmaz (no-op).  
- Push **sadece development build / production build**’de çalışır; Expo Go’da push gelmez.

### 3. İzin reddi

- `getExpoPushTokenAsync()` izin istiyor; kullanıcı “İzin verme” derse token `null`, kayıt yapılmaz.

### 4. Edge function / backend

- `send-expo-push`: `guestIds` veya `staffIds` ile `push_tokens`’tan token çekiyor.  
  İlgili `staff_id` / `guest_id` için satır yoksa token listesi boş, Expo’ya hiç istek gitmez.  
- RLS: Staff kendi `staff_id`’si ile `push_tokens`’a yazabiliyor; guest tarafı `upsert_guest_push_token` RPC ile.  
  Edge function service role ile okuyor; RLS burada engel değil.

### 5. Misafir (guest) tarafı

- Guest token’ı **Bildirimler** ekranı açıldığında `getExpoPushTokenAsync()` + `savePushTokenForGuest(appToken)` ile kaydediliyor.  
- `app_token` yoksa veya RPC hata verirse guest için de token yazılmaz.

---

## Yapılan iyileştirme (kod)

- **savePushTokenForStaff:** Cihazda token yoksa (`getStoredExpoPushToken()` boş) artık **önce** `getExpoPushTokenAsync()` çağrılıyor; böylece izin istenip token alınıyor ve aynı çağrıda backend’e kaydediliyor.  
  Böylece authStore’daki tek `savePushTokenForStaff(staff.id)` çağrısı bile, ilk açılışta token yoksa token alıp kaydetmeyi deniyor.

---

## iOS’ta bildirim gelmiyorsa

- **SDK 53+**: iOS’ta `getExpoPushTokenAsync()` bazen hiç dönmeyebilir (bilinen bug). Kodda **workaround** var:
  - İzin `requestPermissionsAsync` ile **iOS için açık seçeneklerle** (allowAlert, allowBadge, allowSound) isteniyor.
  - Token için `addPushTokenListener` kaydediliyor; token bu listener ile de alınabiliyor.
  - `getExpoPushTokenAsync` en fazla ~14 saniye bekleniyor; önce dönen (native çağrı veya listener) kullanılıyor.
- **EAS Build**: iOS push için uygulamanın **EAS ile build** edilmiş olması ve Apple tarafında **Push Notifications** capability’sinin açık olması gerekir. `expo-notifications` eklentisi build sırasında bunu ekler.
- **Test**: Gerçek cihazda test edin; simülatörde push gelmez.

---

## Kontrol listesi (push gelmiyorsa)

1. **Development build** veya **production build** kullan (Expo Go değil).
2. Uygulama bildirim **izin** verildi mi? (Ayarlar → Valoria → Bildirimler)
3. Staff isen: Giriş sonrası en az bir kez **Bildirimler** sekmesine gir (token orada da kaydediliyor).
4. Supabase Dashboard → Table Editor → `push_tokens`: İlgili `staff_id` veya `guest_id` için satır var mı?
5. Edge function log: `send-expo-push` çağrılıyor mu, yanıtta `sent: 0` mı? (sent: 0 ise genelde token bulunamadı.)
6. **iOS**: Uygulama EAS ile mi build edildi? Cihazda Ayarlar → Valoria → Bildirimler açık mı?
