-- Staff: transfer talebini silme (araç/tur hizmeti değil, talep kaydı)

BEGIN;

DROP POLICY IF EXISTS "transfer_requests_delete_staff" ON public.transfer_service_requests;
CREATE POLICY "transfer_requests_delete_staff"
  ON public.transfer_service_requests FOR DELETE TO authenticated
  USING (
    organization_id = public.current_staff_organization_id()
    AND (public.staff_has_transfer_tour_request_permission() OR public.current_user_is_staff_admin())
  );

COMMIT;
