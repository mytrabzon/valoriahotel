-- Yönetim (otel sahibi / admin) personel değerlendirmesi: çok boyutlu yıldız (1–5), dönem alanları, personel görünürlüğü.
-- Son kayıt staff.evaluation_* özet sütunlarıyla senkronize edilir (mevcut Değerlendirme hub ile uyum).

CREATE TABLE IF NOT EXISTS public.staff_management_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  evaluator_staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_title TEXT,
  period_start DATE,
  period_end DATE,
  star_teamwork SMALLINT NOT NULL CHECK (star_teamwork >= 1 AND star_teamwork <= 5),
  star_discipline SMALLINT NOT NULL CHECK (star_discipline >= 1 AND star_discipline <= 5),
  star_job_skills SMALLINT NOT NULL CHECK (star_job_skills >= 1 AND star_job_skills <= 5),
  star_respect_peers SMALLINT NOT NULL CHECK (star_respect_peers >= 1 AND star_respect_peers <= 5),
  star_rule_compliance SMALLINT NOT NULL CHECK (star_rule_compliance >= 1 AND star_rule_compliance <= 5),
  star_communication SMALLINT NOT NULL CHECK (star_communication >= 1 AND star_communication <= 5),
  star_initiative SMALLINT NOT NULL CHECK (star_initiative >= 1 AND star_initiative <= 5),
  star_guest_focus SMALLINT NOT NULL CHECK (star_guest_focus >= 1 AND star_guest_focus <= 5),
  star_punctuality SMALLINT NOT NULL CHECK (star_punctuality >= 1 AND star_punctuality <= 5),
  overall_star_avg NUMERIC(4, 2) GENERATED ALWAYS AS (
    (
      star_teamwork + star_discipline + star_job_skills + star_respect_peers + star_rule_compliance
      + star_communication + star_initiative + star_guest_focus + star_punctuality
    )::numeric / 9.0
  ) STORED,
  manager_comment TEXT,
  staff_acknowledged_at TIMESTAMPTZ,
  extra_stars JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_staff_mgmt_eval_staff_created
  ON public.staff_management_evaluations (staff_id, created_at DESC);

COMMENT ON TABLE public.staff_management_evaluations IS 'Admin yönetim değerlendirmesi; personel kendi kayıtlarını görür; son kayıt staff özet skorlarına yansır.';
COMMENT ON COLUMN public.staff_management_evaluations.manager_comment IS 'Yönetici görüşü (personel görür; saygılı ve yapıcı dil önerilir).';
COMMENT ON COLUMN public.staff_management_evaluations.extra_stars IS 'İleride ek kriter anahtarları: {"key": 1-5}.';

CREATE OR REPLACE FUNCTION public.touch_staff_management_evaluations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_mgmt_eval_touch ON public.staff_management_evaluations;
CREATE TRIGGER trg_staff_mgmt_eval_touch
  BEFORE UPDATE ON public.staff_management_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_staff_management_evaluations_updated_at();

-- Son değerlendirme -> public.staff özet alanları (0–100 ölçeği)
CREATE OR REPLACE FUNCTION public._sync_staff_eval_from_latest_mgmt(p_staff_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.staff_management_evaluations%ROWTYPE;
  v_avg NUMERIC;
BEGIN
  SELECT * INTO r
  FROM public.staff_management_evaluations
  WHERE staff_id = p_staff_id
  ORDER BY created_at DESC NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    UPDATE public.staff
    SET
      evaluation_score = NULL,
      evaluation_discipline = NULL,
      evaluation_communication = NULL,
      evaluation_speed = NULL,
      evaluation_responsibility = NULL,
      evaluation_insight = NULL,
      updated_at = now()
    WHERE id = p_staff_id;
    RETURN;
  END IF;

  v_avg := r.overall_star_avg;

  UPDATE public.staff
  SET
    evaluation_score = LEAST(100, GREATEST(0, ROUND(v_avg * 20)::INT)),
    evaluation_discipline = r.star_discipline * 20,
    evaluation_communication = r.star_communication * 20,
    evaluation_speed = r.star_job_skills * 20,
    evaluation_responsibility = LEAST(
      100,
      GREATEST(
        0,
        ROUND(
          ((r.star_teamwork + r.star_initiative + r.star_rule_compliance)::numeric / 3.0) * 20
        )::INT
      )
    ),
    evaluation_insight = LEFT(NULLIF(BTRIM(r.manager_comment), ''), 500),
    updated_at = now()
  WHERE id = p_staff_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_staff_mgmt_eval_sync_staff()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public._sync_staff_eval_from_latest_mgmt(OLD.staff_id);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.staff_id IS DISTINCT FROM NEW.staff_id THEN
    PERFORM public._sync_staff_eval_from_latest_mgmt(OLD.staff_id);
  END IF;
  PERFORM public._sync_staff_eval_from_latest_mgmt(NEW.staff_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_mgmt_eval_sync_staff ON public.staff_management_evaluations;
CREATE TRIGGER trg_staff_mgmt_eval_sync_staff
  AFTER INSERT OR UPDATE OR DELETE ON public.staff_management_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_staff_mgmt_eval_sync_staff();

ALTER TABLE public.staff_management_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_mgmt_eval_select" ON public.staff_management_evaluations;
CREATE POLICY "staff_mgmt_eval_select" ON public.staff_management_evaluations
  FOR SELECT TO authenticated
  USING (
    staff_id IN (SELECT s.id FROM public.staff s WHERE s.auth_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.auth_id = auth.uid() AND s.role = 'admin' AND COALESCE(s.is_active, true) AND s.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "staff_mgmt_eval_insert_admin" ON public.staff_management_evaluations;
CREATE POLICY "staff_mgmt_eval_insert_admin" ON public.staff_management_evaluations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.auth_id = auth.uid() AND s.role = 'admin' AND COALESCE(s.is_active, true) AND s.deleted_at IS NULL
    )
    AND evaluator_staff_id = (SELECT s2.id FROM public.staff s2 WHERE s2.auth_id = auth.uid() LIMIT 1)
    AND staff_id <> evaluator_staff_id
  );

DROP POLICY IF EXISTS "staff_mgmt_eval_update_admin" ON public.staff_management_evaluations;
CREATE POLICY "staff_mgmt_eval_update_admin" ON public.staff_management_evaluations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.auth_id = auth.uid() AND s.role = 'admin' AND COALESCE(s.is_active, true) AND s.deleted_at IS NULL
    )
  )
  WITH CHECK (true);

DROP POLICY IF EXISTS "staff_mgmt_eval_delete_admin" ON public.staff_management_evaluations;
CREATE POLICY "staff_mgmt_eval_delete_admin" ON public.staff_management_evaluations
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.auth_id = auth.uid() AND s.role = 'admin' AND COALESCE(s.is_active, true) AND s.deleted_at IS NULL
    )
  );

CREATE OR REPLACE FUNCTION public.acknowledge_staff_management_evaluation(p_eval_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.staff_management_evaluations e
  SET staff_acknowledged_at = COALESCE(e.staff_acknowledged_at, now())
  WHERE e.id = p_eval_id
    AND e.staff_id = (SELECT s.id FROM public.staff s WHERE s.auth_id = auth.uid() LIMIT 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.acknowledge_staff_management_evaluation(UUID) TO authenticated;

COMMENT ON FUNCTION public.acknowledge_staff_management_evaluation IS 'Personel değerlendirmeyi okuduğunu işaretler (idempotent).';
