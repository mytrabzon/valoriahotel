-- Guest self profile photo update (RLS-safe)
-- Some environments don't allow client UPDATE on public.guests; this policy + RPC fixes it.

BEGIN;

-- Allow authenticated guest to update *their own* guest row (mapped by auth_user_id)
DROP POLICY IF EXISTS "guests_authenticated_update_own" ON public.guests;
CREATE POLICY "guests_authenticated_update_own" ON public.guests
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- RPC: update my guest photo_url (used by mobile app after uploading avatar)
CREATE OR REPLACE FUNCTION public.update_my_guest_photo_url(p_photo_url TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;

  UPDATE public.guests
  SET photo_url = NULLIF(trim(p_photo_url), ''),
      updated_at = now()
  WHERE auth_user_id = v_uid
    AND deleted_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_guest_photo_url(TEXT) TO authenticated;

COMMIT;

