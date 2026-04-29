-- upsert ... ON CONFLICT DO UPDATE postgrest üzerinde UPDATE tetikler; RLS’de UPDATE yoksa ikinci onay/upsert sessizce başarısız olabilir.
DROP POLICY IF EXISTS privacy_consent_update_own ON public.privacy_consent;
CREATE POLICY privacy_consent_update_own ON public.privacy_consent
  FOR UPDATE
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());
