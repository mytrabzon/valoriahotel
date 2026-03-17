-- Tek yetkili admin: sonertoprak97@gmail.com (Auth UID: 8eabcee5-44bb-47c9-b05c-c98d9503b171)
-- Bu migration'ı çalıştırmadan önce bu e-posta ile auth.users'da kayıt oluşturulmuş olmalı (magic link / kayıt).

-- Diğer tüm admin yetkilerini kaldır (sadece bu UID admin kalsın)
UPDATE public.staff
SET role = 'receptionist'
WHERE role = 'admin'
  AND auth_id <> '8eabcee5-44bb-47c9-b05c-c98d9503b171';

-- Bu hesabı staff tablosuna ekle veya güncelle (role = admin, tam yetki)
INSERT INTO public.staff (auth_id, email, full_name, role, department, is_active)
VALUES (
  '8eabcee5-44bb-47c9-b05c-c98d9503b171',
  'sonertoprak97@gmail.com',
  'Admin',
  'admin',
  NULL,
  true
)
ON CONFLICT (auth_id)
DO UPDATE SET
  role = 'admin',
  email = EXCLUDED.email,
  full_name = COALESCE(public.staff.full_name, EXCLUDED.full_name),
  is_active = true,
  updated_at = now();
