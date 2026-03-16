# E-posta ile Giriş / Kayıt – Magic Link ve 6 Haneli Kod

Uygulama içi akış: e-posta → kod veya magic link gönder → 6 haneli kodu gir veya e-postadaki linke tıkla.

## Supabase Redirect URL (zorunlu)

Magic link’in uygulama içinde açılması için Supabase **Redirect URLs** listesinde şu adres olmalı:

```
valoria-hotel://auth/callback
```

(Bunu daha önce eklemiştiniz; yoksa ekleyin.)

## Akışlar

1. **E-posta + 6 haneli kod**  
   Kullanıcı e-posta girer → "Kod / Magic link gönder" → Supabase e-posta gönderir → Kod ekranı açılır → 6 hane girilir → giriş.

2. **Magic link**  
   Aynı e-posta ile link gönderilir → Kullanıcı e-postadaki linke tıklar → Uygulama açılır (`valoria-hotel://auth/callback#...`) → oturum kurulur, giriş tamamlanır.

3. **Şifre ile giriş / kayıt**  
   "Şifre ile giriş" veya "Kayıt ol" → e-posta + şifre (kayıtta tekrar şifre) → giriş veya kayıt.

4. **Şifremi unuttum**  
   E-posta yazılır → "Sıfırlama linki gönder" → Supabase şifre sıfırlama e-postası gönderir → Link yine `valoria-hotel://auth/callback` ile uygulama içinde açılabilir (veya tarayıcıda).

## 6 haneli kod (isteğe bağlı)

Varsayılan Supabase e-postası **magic link** (uzun URL) içerir. Uygulama hem **magic link** hem de **6 haneli kod** ile doğrulamayı dener:

- Önce `type: 'email'` (6 haneli OTP) denenir.
- Olmazsa `type: 'magiclink'` ile tekrar denenir.

Supabase’de 6 haneli OTP kullanmak isterseniz:

1. **Supabase Dashboard** → **Authentication** → **Email Templates**
2. **Magic Link** şablonunu açın.
3. Metinde kullanıcıya bir kod göstermek istiyorsanız, şablonu örneğin şöyle düzenleyebilirsiniz (Supabase’in sağladığı değişkenleri kullanın):

   - Link: `{{ .ConfirmationURL }}` (uygulama redirect’i için bu URL’nin `valoria-hotel://auth/callback`’e yönlendirdiğinden emin olun)
   - İsterseniz metne: "Giriş kodunuz: **{{ .Token }}**" ekleyebilirsiniz (Supabase’in token’ı 6 hane değilse, sadece magic link kullanılır; uygulama yine de çalışır).

Redirect URL’in uygulama deep link’i olduğundan emin olun; böylece magic link tıklanınca uygulama açılır ve giriş uygulama içinde tamamlanır.
