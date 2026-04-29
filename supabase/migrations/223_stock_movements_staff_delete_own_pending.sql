-- Allow staff to delete their own non-approved stock movements.
-- Admins can still delete any movement.

DROP POLICY IF EXISTS "stock_movements_delete" ON public.stock_movements;

CREATE POLICY "stock_movements_delete" ON public.stock_movements
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM public.staff s
      WHERE s.auth_id = auth.uid()
        AND s.is_active = true
        AND s.deleted_at IS NULL
        AND (
          s.role = 'admin'
          OR (
            s.id = stock_movements.staff_id
            AND COALESCE(stock_movements.status, 'pending') <> 'approved'
          )
        )
    )
  );

