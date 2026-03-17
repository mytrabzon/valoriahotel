# Şifre sıfırlama e-postasında 6 haneli kodun görünmesi

Uygulama hem **e-postadaki linke tıklama** hem de **6 haneli kodu girme** ile şifre sıfırlamayı destekler. Varsayılan Supabase şablonunda sadece link vardır; **kodu da e-postada göstermek** için şablonu aşağıdaki gibi güncellemeniz gerekir.

## Ne yapmalı?

1. **Supabase Dashboard** → projenizi seçin  
2. **Authentication** → **Email Templates**  
3. **“Change Password” (Recovery)** şablonunu açın  
4. Şablon metninde hem link hem kod olsun istiyorsanız, aşağıdaki örnek içeriği kullanın veya mevcut şablona sadece kod satırını ekleyin.

## Örnek şablon (link + 6 haneli kod)

**Konu (Subject):**  
`Şifrenizi sıfırlayın`

**İçerik (Body) – HTML örneği:**

```html
<h2>Şifre sıfırlama</h2>
<p>Merhaba,</p>
<p>Şifre sıfırlama talebinde bulundunuz.</p>
<p><strong>6 haneli kodunuz:</strong> {{ .Token }}</p>
<p>Bu kodu uygulamada ilgili alana girebilirsiniz.</p>
<p>Alternatif olarak aşağıdaki linke tıklayarak da şifrenizi sıfırlayabilirsiniz:</p>
<p><a href="{{ .ConfirmationURL }}">Şifreyi sıfırla</a></p>
<p>Bu talebi siz yapmadıysanız bu e-postayı dikkate almayın.</p>
```

- `{{ .Token }}` → E-postada **6 haneli kod** olarak görünür.  
- `{{ .ConfirmationURL }}` → “Şifreyi sıfırla” **linki**.  
İkisi de aynı işlemi yapar; kullanıcı ya kodu girer ya da linke tıklar.

## Önemli

- **Kod gelmiyorsa** tek neden genelde şablonda `{{ .Token }}` olmamasıdır. Yukarıdaki gibi ekleyin.  
- E-posta gidiyor ama kod görünmüyorsa: Supabase’te sadece bu “Change Password” şablonunu kontrol edin; uygulama kodu değiştirilmediği sürece sorun şablondadır.
