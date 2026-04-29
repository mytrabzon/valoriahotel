BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.missing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_by_staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  resolved_by_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  last_reminded_at timestamptz,
  reminder_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT missing_items_title_not_blank CHECK (length(trim(title)) > 0),
  CONSTRAINT missing_items_resolve_fields_consistent CHECK (
    (status = 'resolved' AND resolved_at IS NOT NULL AND resolved_by_staff_id IS NOT NULL)
    OR status <> 'resolved'
  )
);

CREATE INDEX IF NOT EXISTS idx_missing_items_org_status_created
  ON public.missing_items (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_missing_items_org_open_reminder
  ON public.missing_items (organization_id, status, last_reminded_at, created_at);

CREATE OR REPLACE FUNCTION public.missing_items_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_missing_items_updated_at ON public.missing_items;
CREATE TRIGGER trg_missing_items_updated_at
  BEFORE UPDATE ON public.missing_items
  FOR EACH ROW EXECUTE FUNCTION public.missing_items_set_updated_at();

CREATE OR REPLACE FUNCTION public.missing_items_set_resolve_meta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id uuid;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  v_staff_id := public.current_staff_id();

  IF NEW.status = 'resolved' THEN
    NEW.resolved_at := now();
    NEW.resolved_by_staff_id := COALESCE(NEW.resolved_by_staff_id, v_staff_id);
  ELSE
    NEW.resolved_at := NULL;
    NEW.resolved_by_staff_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_missing_items_set_resolve_meta ON public.missing_items;
CREATE TRIGGER trg_missing_items_set_resolve_meta
  BEFORE UPDATE ON public.missing_items
  FOR EACH ROW EXECUTE FUNCTION public.missing_items_set_resolve_meta();

CREATE OR REPLACE FUNCTION public.missing_items_notify_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_ids uuid[];
  v_actor_name text;
  v_title text;
  v_body text;
  v_payload jsonb;
BEGIN
  SELECT array_agg(s.id)
  INTO v_staff_ids
  FROM public.staff s
  WHERE s.organization_id = NEW.organization_id
    AND s.is_active = true
    AND s.deleted_at IS NULL;

  IF v_staff_ids IS NULL OR array_length(v_staff_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT st.full_name INTO v_actor_name
  FROM public.staff st
  WHERE st.id = COALESCE(NEW.resolved_by_staff_id, NEW.created_by_staff_id)
  LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    v_title := 'Eksik Var - Yeni eksik: ' || NEW.title;
    v_body := COALESCE(NULLIF(trim(NEW.description), ''), 'Yeni eksik kaydi olusturuldu.');
    v_payload := jsonb_build_object(
      'kind', 'missing_item_opened',
      'missingItemId', NEW.id::text,
      'url', '/staff/missing-items'
    );

    INSERT INTO public.notifications (
      staff_id, guest_id, title, body, category, notification_type, data, created_by, sent_via, sent_at
    )
    SELECT sid, NULL, v_title, v_body, 'staff', 'missing_item_opened', v_payload, NEW.created_by_staff_id, 'both', now()
    FROM unnest(v_staff_ids) sid;

    PERFORM net.http_post(
      url := 'https://sbydlcujsiqmifybqzsi.supabase.co/functions/v1/send-expo-push',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'staffIds', to_jsonb(v_staff_ids),
        'title', v_title,
        'body', v_body,
        'data', v_payload
      ),
      timeout_milliseconds := 10000
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'open' AND NEW.status = 'resolved' THEN
    v_title := 'Eksik Var - Giderildi: ' || NEW.title;
    v_body := COALESCE(NULLIF(trim(v_actor_name), ''), 'Bir personel') || ' eksigi giderildi olarak isaretledi.';
    v_payload := jsonb_build_object(
      'kind', 'missing_item_resolved',
      'missingItemId', NEW.id::text,
      'url', '/staff/missing-items'
    );

    INSERT INTO public.notifications (
      staff_id, guest_id, title, body, category, notification_type, data, created_by, sent_via, sent_at
    )
    SELECT sid, NULL, v_title, v_body, 'staff', 'missing_item_resolved', v_payload, NEW.resolved_by_staff_id, 'both', now()
    FROM unnest(v_staff_ids) sid;

    PERFORM net.http_post(
      url := 'https://sbydlcujsiqmifybqzsi.supabase.co/functions/v1/send-expo-push',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'staffIds', to_jsonb(v_staff_ids),
        'title', v_title,
        'body', v_body,
        'data', v_payload
      ),
      timeout_milliseconds := 10000
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_missing_items_notify_insert ON public.missing_items;
CREATE TRIGGER trg_missing_items_notify_insert
  AFTER INSERT ON public.missing_items
  FOR EACH ROW EXECUTE FUNCTION public.missing_items_notify_change();

DROP TRIGGER IF EXISTS trg_missing_items_notify_resolve ON public.missing_items;
CREATE TRIGGER trg_missing_items_notify_resolve
  AFTER UPDATE OF status ON public.missing_items
  FOR EACH ROW EXECUTE FUNCTION public.missing_items_notify_change();

CREATE OR REPLACE FUNCTION public.send_missing_items_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_staff_ids uuid[];
  v_body text;
  v_sent integer := 0;
BEGIN
  FOR v_row IN
    SELECT mi.id, mi.title, mi.description, mi.organization_id, mi.created_by_staff_id
    FROM public.missing_items mi
    WHERE mi.status = 'open'
      AND coalesce(mi.last_reminded_at, mi.created_at) <= now() - interval '5 hours'
    ORDER BY mi.created_at ASC
    LIMIT 200
  LOOP
    SELECT array_agg(s.id)
    INTO v_staff_ids
    FROM public.staff s
    WHERE s.organization_id = v_row.organization_id
      AND s.is_active = true
      AND s.deleted_at IS NULL;

    IF v_staff_ids IS NULL OR array_length(v_staff_ids, 1) IS NULL THEN
      CONTINUE;
    END IF;

    v_body := COALESCE(NULLIF(trim(v_row.description), ''), 'Bu eksik kaydi hala acik durumda.');

    INSERT INTO public.notifications (
      staff_id, guest_id, title, body, category, notification_type, data, created_by, sent_via, sent_at
    )
    SELECT
      sid,
      NULL,
      'Eksik Var - Acik eksik: ' || v_row.title,
      v_body,
      'staff',
      'missing_item_reminder',
      jsonb_build_object(
        'kind', 'missing_item_reminder',
        'missingItemId', v_row.id::text,
        'url', '/staff/missing-items'
      ),
      v_row.created_by_staff_id,
      'both',
      now()
    FROM unnest(v_staff_ids) sid;

    PERFORM net.http_post(
      url := 'https://sbydlcujsiqmifybqzsi.supabase.co/functions/v1/send-expo-push',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'staffIds', to_jsonb(v_staff_ids),
        'title', 'Eksik Var - Acik eksik: ' || v_row.title,
        'body', v_body,
        'data', jsonb_build_object(
          'kind', 'missing_item_reminder',
          'missingItemId', v_row.id::text,
          'url', '/staff/missing-items'
        )
      ),
      timeout_milliseconds := 10000
    );

    UPDATE public.missing_items
    SET
      last_reminded_at = now(),
      reminder_count = reminder_count + 1
    WHERE id = v_row.id;

    v_sent := v_sent + 1;
  END LOOP;

  RETURN v_sent;
END;
$$;

-- 5 saatte bir acik eksik kayitlari hatirlat.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.unschedule('missing_items_reminder_5h')
  WHERE EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'missing_items_reminder_5h'
  );
  PERFORM cron.schedule(
    'missing_items_reminder_5h',
    '0 */5 * * *',
    'SELECT public.send_missing_items_reminders();'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron schedule skipped: %', SQLERRM;
END;
$$;

ALTER TABLE public.missing_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "missing_items_select_staff_org" ON public.missing_items;
CREATE POLICY "missing_items_select_staff_org"
  ON public.missing_items FOR SELECT TO authenticated
  USING (organization_id = public.current_staff_organization_id());

DROP POLICY IF EXISTS "missing_items_insert_staff_org" ON public.missing_items;
CREATE POLICY "missing_items_insert_staff_org"
  ON public.missing_items FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_staff_organization_id()
    AND created_by_staff_id = public.current_staff_id()
  );

DROP POLICY IF EXISTS "missing_items_update_staff_org" ON public.missing_items;
CREATE POLICY "missing_items_update_staff_org"
  ON public.missing_items FOR UPDATE TO authenticated
  USING (organization_id = public.current_staff_organization_id())
  WITH CHECK (organization_id = public.current_staff_organization_id());

COMMIT;
