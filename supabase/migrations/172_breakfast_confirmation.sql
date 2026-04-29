-- Kahvaltı Teyit Kaydı: ayarlar, kayıtlar, RLS, doğrulama tetikleyicileri, storage bucket

BEGIN;

-- ========== Yardımcılar (tablo bağımsız) ==========

CREATE OR REPLACE FUNCTION public.current_date_istanbul()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (now() AT TIME ZONE 'Europe/Istanbul')::date;
$$;

/** storage.objects.name: "authUid/org/{org_uuid}/..." veya "org/{org_uuid}/..." */
CREATE OR REPLACE FUNCTION public.storage_extract_org_id_from_path(p_name text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m text[];
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RETURN NULL;
  END IF;
  SELECT regexp_match(p_name, '/org/([a-f0-9-]{8}-[a-f0-9-]{4}-[a-f0-9-]{4}-[a-f0-9-]{4}-[a-f0-9-]{12})/') INTO m;
  IF m IS NOT NULL THEN
    BEGIN
      RETURN m[1]::uuid;
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
  END IF;
  IF p_name ~ '^org/[a-f0-9-]{8}-' THEN
    BEGIN
      RETURN (substring(p_name from '^org/([^/]+)/'))::uuid;
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_department_allows_breakfast()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT s.department IN ('kitchen', 'restaurant')
     FROM public.staff s
     WHERE s.auth_id = auth.uid()
       AND COALESCE(s.is_active, true) = true
       AND s.deleted_at IS NULL
     LIMIT 1),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.storage_extract_org_id_from_path(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_extract_org_id_from_path(text) TO authenticated;

-- ========== Tablolar ==========

CREATE TABLE IF NOT EXISTS public.breakfast_confirmation_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature_enabled boolean NOT NULL DEFAULT true,
  min_photos int NOT NULL DEFAULT 1,
  max_photos int NOT NULL DEFAULT 3,
  guest_count_required boolean NOT NULL DEFAULT true,
  note_required boolean NOT NULL DEFAULT false,
  daily_record_limit int NOT NULL DEFAULT 1,
  submission_time_start time,
  submission_time_end time,
  require_kitchen_department boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT breakfast_settings_photos_sane CHECK (min_photos >= 0 AND max_photos >= min_photos AND max_photos <= 10),
  CONSTRAINT breakfast_settings_daily_limit CHECK (daily_record_limit >= 1)
);

INSERT INTO public.breakfast_confirmation_settings (organization_id)
SELECT o.id FROM public.organizations o
ON CONFLICT (organization_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.breakfast_confirmation_settings_seed_for_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.breakfast_confirmation_settings (organization_id) VALUES (NEW.id)
  ON CONFLICT (organization_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_org_breakfast_settings_seed ON public.organizations;
CREATE TRIGGER trg_org_breakfast_settings_seed
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.breakfast_confirmation_settings_seed_for_org();

CREATE TABLE IF NOT EXISTS public.breakfast_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  record_date date NOT NULL,
  guest_count integer NOT NULL DEFAULT 0,
  note text,
  photo_urls text[] NOT NULL DEFAULT '{}',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT breakfast_confirm_guest_nonnegative CHECK (guest_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS breakfast_confirm_org_staff_date_uidx
  ON public.breakfast_confirmations (organization_id, staff_id, record_date);

CREATE INDEX IF NOT EXISTS breakfast_confirm_org_date_idx
  ON public.breakfast_confirmations (organization_id, record_date DESC);

CREATE INDEX IF NOT EXISTS breakfast_confirm_staff_idx
  ON public.breakfast_confirmations (staff_id, record_date DESC);

-- ========== Ayar tablosuna bağlı yardımcılar ==========

CREATE OR REPLACE FUNCTION public.staff_can_breakfast_feature_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT bcs.feature_enabled
     FROM public.breakfast_confirmation_settings bcs
     WHERE bcs.organization_id = public.current_staff_organization_id()
     LIMIT 1),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.staff_can_breakfast_create_record()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_require_kitchen boolean;
BEGIN
  IF public.current_user_is_staff_admin() THEN
    RETURN true;
  END IF;
  IF NOT public.staff_can_breakfast_feature_enabled() THEN
    RETURN false;
  END IF;
  IF NOT public.staff_has_app_permission('kahvalti_teyit_olustur') THEN
    RETURN false;
  END IF;
  SELECT COALESCE(bcs.require_kitchen_department, true)
  INTO v_require_kitchen
  FROM public.breakfast_confirmation_settings bcs
  WHERE bcs.organization_id = public.current_staff_organization_id()
  LIMIT 1;
  IF v_require_kitchen IS NULL THEN
    v_require_kitchen := true;
  END IF;
  IF v_require_kitchen AND NOT public.staff_department_allows_breakfast() THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.breakfast_storage_insert_allowed(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_require_kitchen boolean;
BEGIN
  IF public.current_user_is_staff_admin() THEN
    RETURN true;
  END IF;
  v_org := public.storage_extract_org_id_from_path(p_object_name);
  IF v_org IS NULL OR v_org IS DISTINCT FROM public.current_staff_organization_id() THEN
    RETURN false;
  END IF;
  IF NOT public.staff_can_breakfast_feature_enabled() THEN
    RETURN false;
  END IF;
  IF NOT public.staff_has_app_permission('kahvalti_teyit_olustur') THEN
    RETURN false;
  END IF;
  SELECT COALESCE(bcs.require_kitchen_department, true)
  INTO v_require_kitchen
  FROM public.breakfast_confirmation_settings bcs
  WHERE bcs.organization_id = v_org
  LIMIT 1;
  IF v_require_kitchen IS NULL THEN
    v_require_kitchen := true;
  END IF;
  IF v_require_kitchen AND NOT public.staff_department_allows_breakfast() THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.breakfast_storage_insert_allowed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.breakfast_storage_insert_allowed(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.breakfast_storage_insert_allowed(text) TO service_role;

-- ========== updated_at ==========

CREATE OR REPLACE FUNCTION public.breakfast_confirmations_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_breakfast_confirmations_updated ON public.breakfast_confirmations;
CREATE TRIGGER trg_breakfast_confirmations_updated
  BEFORE UPDATE ON public.breakfast_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.breakfast_confirmations_set_updated_at();

CREATE OR REPLACE FUNCTION public.breakfast_confirmation_settings_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_breakfast_confirmation_settings_updated ON public.breakfast_confirmation_settings;
CREATE TRIGGER trg_breakfast_confirmation_settings_updated
  BEFORE UPDATE ON public.breakfast_confirmation_settings
  FOR EACH ROW EXECUTE FUNCTION public.breakfast_confirmation_settings_set_updated_at();

-- ========== Doğrulama (iş kuralları) ==========

CREATE OR REPLACE FUNCTION public.breakfast_confirmations_validate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  cfg record;
  n_photos int;
  t_ist time;
BEGIN
  SELECT * INTO cfg FROM public.breakfast_confirmation_settings b
  WHERE b.organization_id = NEW.organization_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kahvaltı ayarları bulunamadı.';
  END IF;
  IF NOT cfg.feature_enabled THEN
    RAISE EXCEPTION 'Kahvaltı teyit özelliği bu işletme için kapalı.';
  END IF;

  SELECT * INTO s FROM public.staff st WHERE st.id = NEW.staff_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Personel bulunamadı.';
  END IF;
  IF s.organization_id IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'İşletme eşleşmesi geçersiz.';
  END IF;
  IF COALESCE(cfg.require_kitchen_department, true) AND s.department IS NOT NULL
     AND s.department NOT IN ('kitchen', 'restaurant') THEN
    RAISE EXCEPTION 'Bu departman kahvaltı teyidi oluşturamaz.';
  END IF;

  n_photos := COALESCE(array_length(NEW.photo_urls, 1), 0);
  IF n_photos < cfg.min_photos OR n_photos > cfg.max_photos THEN
    RAISE EXCEPTION 'Fotoğraf sayısı % ile % arasında olmalı.', cfg.min_photos, cfg.max_photos;
  END IF;
  IF cfg.guest_count_required AND (NEW.guest_count IS NULL OR NEW.guest_count <= 0) THEN
    RAISE EXCEPTION 'Kişi sayısı zorunludur.';
  END IF;
  IF cfg.note_required AND (NEW.note IS NULL OR btrim(NEW.note) = '') THEN
    RAISE EXCEPTION 'Not zorunludur.';
  END IF;

  IF TG_OP = 'INSERT' AND cfg.submission_time_start IS NOT NULL AND cfg.submission_time_end IS NOT NULL THEN
    t_ist := (now() AT TIME ZONE 'Europe/Istanbul')::time;
    IF cfg.submission_time_start <= cfg.submission_time_end THEN
      IF t_ist < cfg.submission_time_start OR t_ist > cfg.submission_time_end THEN
        RAISE EXCEPTION 'Gönderim bu saat aralığı dışında: % - %', cfg.submission_time_start, cfg.submission_time_end;
      END IF;
    ELSE
      IF t_ist < cfg.submission_time_start AND t_ist > cfg.submission_time_end THEN
        RAISE EXCEPTION 'Gönderim bu saat aralığı dışında: % - % (gece sarkan aralık)', cfg.submission_time_start, cfg.submission_time_end;
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
       OR NEW.staff_id IS DISTINCT FROM OLD.staff_id
       OR NEW.record_date IS DISTINCT FROM OLD.record_date THEN
      RAISE EXCEPTION 'Kayıt kimliği değiştirilemez.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_breakfast_confirmations_validate ON public.breakfast_confirmations;
CREATE TRIGGER trg_breakfast_confirmations_validate
  BEFORE INSERT OR UPDATE ON public.breakfast_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.breakfast_confirmations_validate();

CREATE OR REPLACE FUNCTION public.breakfast_confirmations_enforce_edit_window()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_privileged boolean;
  v_approver_only boolean;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  v_privileged := public.current_user_is_staff_admin()
    OR public.staff_has_app_permission('kahvalti_teyit_departman');

  IF public.staff_has_app_permission('kahvalti_teyit_onayla')
     AND NOT public.current_user_is_staff_admin()
     AND OLD.staff_id IS DISTINCT FROM public.current_staff_id()
     AND NOT public.staff_has_app_permission('kahvalti_teyit_departman') THEN
    v_approver_only := true;
  ELSE
    v_approver_only := false;
  END IF;

  IF v_approver_only THEN
    IF NEW.guest_count IS DISTINCT FROM OLD.guest_count
       OR NEW.note IS DISTINCT FROM OLD.note
       OR NEW.photo_urls IS DISTINCT FROM OLD.photo_urls
       OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Onay yetkisi: yalnızca onay alanları güncellenebilir.';
    END IF;
    RETURN NEW;
  END IF;

  IF v_privileged THEN
    RETURN NEW;
  END IF;

  IF OLD.staff_id IS DISTINCT FROM public.current_staff_id() THEN
    RAISE EXCEPTION 'Bu kaydı düzenleme yetkiniz yok.';
  END IF;

  IF OLD.record_date < public.current_date_istanbul() THEN
    RAISE EXCEPTION 'Sadece bugünün kaydı düzenlenebilir.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_breakfast_confirmations_edit_window ON public.breakfast_confirmations;
CREATE TRIGGER trg_breakfast_confirmations_edit_window
  BEFORE UPDATE ON public.breakfast_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.breakfast_confirmations_enforce_edit_window();

-- ========== RLS ==========

ALTER TABLE public.breakfast_confirmation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breakfast_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "breakfast_settings_select_org" ON public.breakfast_confirmation_settings;
CREATE POLICY "breakfast_settings_select_org"
  ON public.breakfast_confirmation_settings FOR SELECT TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    OR public.current_user_is_staff_admin()
  );

DROP POLICY IF EXISTS "breakfast_settings_update_admin" ON public.breakfast_confirmation_settings;
CREATE POLICY "breakfast_settings_update_admin"
  ON public.breakfast_confirmation_settings FOR UPDATE TO authenticated
  USING (public.current_user_is_staff_admin())
  WITH CHECK (public.current_user_is_staff_admin());

DROP POLICY IF EXISTS "breakfast_confirm_select" ON public.breakfast_confirmations;
CREATE POLICY "breakfast_confirm_select"
  ON public.breakfast_confirmations FOR SELECT TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND (
      public.current_user_is_staff_admin()
      OR staff_id = public.current_staff_id()
      OR public.staff_has_app_permission('kahvalti_rapor')
      OR (
        public.staff_has_app_permission('kahvalti_teyit_departman')
        AND public.staff_department_allows_breakfast()
        AND EXISTS (
          SELECT 1 FROM public.staff c
          WHERE c.id = breakfast_confirmations.staff_id
            AND c.department IN ('kitchen', 'restaurant')
        )
      )
    )
  );

DROP POLICY IF EXISTS "breakfast_confirm_insert" ON public.breakfast_confirmations;
CREATE POLICY "breakfast_confirm_insert"
  ON public.breakfast_confirmations FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_staff_organization_id()
    AND staff_id = public.current_staff_id()
    AND public.staff_can_breakfast_create_record()
  );

DROP POLICY IF EXISTS "breakfast_confirm_update" ON public.breakfast_confirmations;
CREATE POLICY "breakfast_confirm_update"
  ON public.breakfast_confirmations FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND (
      public.current_user_is_staff_admin()
      OR (
        staff_id = public.current_staff_id()
        AND public.staff_has_app_permission('kahvalti_teyit_olustur')
      )
      OR (
        public.staff_has_app_permission('kahvalti_teyit_departman')
        AND public.staff_department_allows_breakfast()
        AND EXISTS (
          SELECT 1 FROM public.staff c
          WHERE c.id = breakfast_confirmations.staff_id
            AND c.department IN ('kitchen', 'restaurant')
        )
      )
      OR (
        public.staff_has_app_permission('kahvalti_teyit_onayla')
      )
    )
  )
  WITH CHECK (organization_id = public.current_staff_organization_id());

DROP POLICY IF EXISTS "breakfast_confirm_delete_admin" ON public.breakfast_confirmations;
CREATE POLICY "breakfast_confirm_delete_admin"
  ON public.breakfast_confirmations FOR DELETE TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND public.current_user_is_staff_admin()
  );

-- ========== Storage ==========

INSERT INTO storage.buckets (id, name, public)
VALUES ('breakfast-confirm', 'breakfast-confirm', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "breakfast_confirm_bucket_read" ON storage.objects;
CREATE POLICY "breakfast_confirm_bucket_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'breakfast-confirm');

DROP POLICY IF EXISTS "breakfast_confirm_bucket_insert" ON storage.objects;
CREATE POLICY "breakfast_confirm_bucket_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'breakfast-confirm'
    AND public.breakfast_storage_insert_allowed(name)
  );

DROP POLICY IF EXISTS "breakfast_confirm_bucket_update" ON storage.objects;
CREATE POLICY "breakfast_confirm_bucket_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'breakfast-confirm' AND public.current_user_is_staff_admin())
  WITH CHECK (bucket_id = 'breakfast-confirm');

DROP POLICY IF EXISTS "breakfast_confirm_bucket_delete" ON storage.objects;
CREATE POLICY "breakfast_confirm_bucket_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'breakfast-confirm' AND public.current_user_is_staff_admin());

GRANT SELECT ON public.breakfast_confirmation_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.breakfast_confirmations TO authenticated;

COMMENT ON TABLE public.breakfast_confirmation_settings IS 'Kahvaltı teyit modülü işletme ayarları.';
COMMENT ON TABLE public.breakfast_confirmations IS 'Günlük kahvaltı teyit kayıtları (foto, kişi sayısı).';

COMMIT;
