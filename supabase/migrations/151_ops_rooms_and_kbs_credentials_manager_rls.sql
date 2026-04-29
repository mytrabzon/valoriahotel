-- Manager: ops.rooms CRUD (KBS oda listesi mobilde Supabase ile).
-- Manager: hotel_kbs_credentials sadece OKUMA (form doldurma); yazma yalnızca admin (şifre şifrelemesi gateway’de).
BEGIN;

DROP POLICY IF EXISTS "ops_rooms_admin_write" ON ops.rooms;
CREATE POLICY "ops_rooms_admin_write" ON ops.rooms
  FOR ALL TO authenticated
  USING (
    hotel_id = ops.current_hotel_id()
    AND ops.current_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    hotel_id = ops.current_hotel_id()
    AND ops.current_role() IN ('admin', 'manager')
  );

DROP POLICY IF EXISTS "ops_kbs_credentials_admin_select" ON ops.hotel_kbs_credentials;
DROP POLICY IF EXISTS "ops_kbs_credentials_admin_write" ON ops.hotel_kbs_credentials;

CREATE POLICY "ops_kbs_credentials_select_hotel" ON ops.hotel_kbs_credentials
  FOR SELECT TO authenticated
  USING (
    hotel_id = ops.current_hotel_id()
    AND ops.current_role() IN ('admin', 'manager')
  );

CREATE POLICY "ops_kbs_credentials_insert_admin" ON ops.hotel_kbs_credentials
  FOR INSERT TO authenticated
  WITH CHECK (ops.is_admin() AND hotel_id = ops.current_hotel_id());

CREATE POLICY "ops_kbs_credentials_update_admin" ON ops.hotel_kbs_credentials
  FOR UPDATE TO authenticated
  USING (ops.is_admin() AND hotel_id = ops.current_hotel_id())
  WITH CHECK (ops.is_admin() AND hotel_id = ops.current_hotel_id());

CREATE POLICY "ops_kbs_credentials_delete_admin" ON ops.hotel_kbs_credentials
  FOR DELETE TO authenticated
  USING (ops.is_admin() AND hotel_id = ops.current_hotel_id());

COMMIT;
