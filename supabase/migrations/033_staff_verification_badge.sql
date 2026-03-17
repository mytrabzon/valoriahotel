-- Valoria Hotel - Çalışan doğrulama rozeti (mavi / sarı tik)
-- Admin mavi veya sarı tik verebilir; tik verilen kullanıcı her yerde rozet ile görünür.

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS verification_badge TEXT
  CHECK (verification_badge IS NULL OR verification_badge IN ('blue', 'yellow'));

COMMENT ON COLUMN public.staff.verification_badge IS 'Doğrulama rozeti: blue = mavi tik, yellow = sarı tik, null = yok. Sadece admin atar/kaldırır.';
CREATE INDEX IF NOT EXISTS idx_staff_verification_badge ON public.staff(verification_badge) WHERE verification_badge IS NOT NULL;
