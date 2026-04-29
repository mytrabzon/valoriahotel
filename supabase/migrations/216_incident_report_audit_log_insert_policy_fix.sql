BEGIN;

-- incident_reports trigger'lari audit log yazarken RLS'e takilmamali.
-- SELECT policy vardi, INSERT policy eksikti.
DROP POLICY IF EXISTS "incident_report_audit_log_insert_staff" ON public.incident_report_audit_log;
CREATE POLICY "incident_report_audit_log_insert_staff"
  ON public.incident_report_audit_log FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_staff_organization_id()
    AND public.staff_has_incident_reports_permission()
    AND EXISTS (
      SELECT 1
      FROM public.incident_reports r
      WHERE r.id = incident_report_audit_log.report_id
        AND r.organization_id = public.current_staff_organization_id()
    )
  );

COMMIT;
