# Valoria Hotel – Supabase doğru hesap

`.env` içindeki proje: **sbydlcujsiqmifybqzsi**  
(`https://sbydlcujsiqmifybqzsi.supabase.co`)

## Yanlış hesapla giriş yaptıysan

1. **Mevcut hesaptan çık:**
   ```bash
   supabase logout
   ```

2. **Valoria projesine sahip hesapla giriş yap** (tarayıcı açılır):
   ```bash
   supabase login
   ```

3. **Bu projeyi Valoria ile bağla:**
   ```bash
   supabase link --project-ref sbydlcujsiqmifybqzsi
   ```
   Şifre/access token sorarsa: Supabase Dashboard → Project Settings → API → `service_role` veya hesap token’ını kullan.

4. **Fonksiyon deploy:**
   ```bash
   supabase functions deploy
   ```

Bu proje (sbydlcujsiqmifybqzsi) listede yoksa, o projeye sahip Supabase hesabıyla `supabase login` yapman gerekir.
