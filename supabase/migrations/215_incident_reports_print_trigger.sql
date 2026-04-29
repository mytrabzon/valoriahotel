BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.incident_report_print_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.incident_reports(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('queued', 'success', 'failed', 'skipped')),
  error_message text,
  request_id bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_report_print_logs_report_id
  ON public.incident_report_print_logs(report_id, sent_at DESC);

ALTER TABLE public.incident_report_print_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "incident_report_print_logs_read_staff" ON public.incident_report_print_logs;
CREATE POLICY "incident_report_print_logs_read_staff"
ON public.incident_report_print_logs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.incident_reports r
    WHERE r.id = incident_report_print_logs.report_id
      AND r.organization_id = public.current_staff_organization_id()
      AND public.staff_has_incident_reports_permission()
  )
);

DROP POLICY IF EXISTS "incident_report_print_logs_insert_service" ON public.incident_report_print_logs;
CREATE POLICY "incident_report_print_logs_insert_service"
ON public.incident_report_print_logs FOR INSERT TO authenticated
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.trigger_print_incident_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_printer jsonb;
  v_enabled boolean;
  v_request_id bigint;
BEGIN
  IF NEW.status <> 'pdf_generated'
     OR NEW.pdf_file_path IS NULL
     OR OLD.status = 'pdf_generated' THEN
    RETURN NEW;
  END IF;

  SELECT value
  INTO v_printer
  FROM public.admin_settings
  WHERE key = 'printer'
  ORDER BY updated_at DESC
  LIMIT 1;

  v_enabled := COALESCE((v_printer->>'enabled')::boolean, true);
  IF NOT v_enabled THEN
    INSERT INTO public.incident_report_print_logs(report_id, status, error_message)
    VALUES (NEW.id, 'skipped', 'Yazdirma ayari kapali');
    RETURN NEW;
  END IF;

  v_request_id := net.http_post(
    url := 'https://sbydlcujsiqmifybqzsi.supabase.co/functions/v1/print-incident-report',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'type', 'UPDATE',
      'table', 'incident_reports',
      'record', jsonb_build_object(
        'id', NEW.id,
        'organization_id', NEW.organization_id,
        'report_no', NEW.report_no,
        'pdf_file_path', NEW.pdf_file_path
      )
    ),
    timeout_milliseconds := 60000
  );

  INSERT INTO public.incident_report_print_logs(report_id, status, request_id)
  VALUES (NEW.id, 'queued', v_request_id);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.incident_report_print_logs(report_id, status, error_message)
  VALUES (NEW.id, 'failed', SQLERRM);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_incident_reports_print ON public.incident_reports;
CREATE TRIGGER trg_incident_reports_print
AFTER UPDATE ON public.incident_reports
FOR EACH ROW
EXECUTE FUNCTION public.trigger_print_incident_report();

COMMIT;
