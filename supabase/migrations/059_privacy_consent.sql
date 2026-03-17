-- Gizlilik politikası onayı: her kullanıcı (auth.uid()) ilk girişte bir kez onaylar; aynı kullanıcıya tekrar sorulmaz.
CREATE TABLE IF NOT EXISTS public.privacy_consent (
  auth_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.privacy_consent IS 'Kullanıcı başına gizlilik politikası onayı; bir kez kaydedilir.';

ALTER TABLE public.privacy_consent ENABLE ROW LEVEL SECURITY;

-- Kullanıcı sadece kendi kaydını görebilir
DROP POLICY IF EXISTS privacy_consent_select_own ON public.privacy_consent;
CREATE POLICY privacy_consent_select_own ON public.privacy_consent
  FOR SELECT
  USING (auth_user_id = auth.uid());

-- Kullanıcı kendi kaydını ekleyebilir (ilk onay)
DROP POLICY IF EXISTS privacy_consent_insert_own ON public.privacy_consent;
CREATE POLICY privacy_consent_insert_own ON public.privacy_consent
  FOR INSERT
  WITH CHECK (auth_user_id = auth.uid());

-- Güncelleme gerekmez (tek seferlik); gerekirse eklenebilir
-- CREATE POLICY privacy_consent_update_own ON public.privacy_consent FOR UPDATE USING (auth_user_id = auth.uid());
