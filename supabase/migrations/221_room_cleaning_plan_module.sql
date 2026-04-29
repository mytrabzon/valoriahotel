BEGIN;

CREATE TABLE IF NOT EXISTS public.room_cleaning_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_date DATE NOT NULL,
  note TEXT,
  created_by_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT room_cleaning_plans_target_date_check CHECK (target_date >= DATE '2020-01-01')
);

CREATE TABLE IF NOT EXISTS public.room_cleaning_plan_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.room_cleaning_plans(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_done BOOLEAN NOT NULL DEFAULT false,
  done_at TIMESTAMPTZ,
  done_by_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  UNIQUE(plan_id, room_id)
);

CREATE TABLE IF NOT EXISTS public.room_cleaning_plan_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.room_cleaning_plans(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  staff_note TEXT,
  UNIQUE(plan_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_room_cleaning_plans_target_date ON public.room_cleaning_plans(target_date DESC);
CREATE INDEX IF NOT EXISTS idx_room_cleaning_plan_rooms_plan_id ON public.room_cleaning_plan_rooms(plan_id, sort_order, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_cleaning_plan_rooms_room_id ON public.room_cleaning_plan_rooms(room_id);
CREATE INDEX IF NOT EXISTS idx_room_cleaning_plan_assignments_staff_id ON public.room_cleaning_plan_assignments(staff_id, plan_id);

CREATE OR REPLACE FUNCTION public.touch_room_cleaning_plan_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_room_cleaning_plans_updated_at ON public.room_cleaning_plans;
CREATE TRIGGER trg_room_cleaning_plans_updated_at
  BEFORE UPDATE ON public.room_cleaning_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_room_cleaning_plan_updated_at();

CREATE OR REPLACE FUNCTION public.notify_room_cleaning_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_number TEXT;
  v_actor_name TEXT;
  v_plan_note TEXT;
  v_room_note TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  IF NEW.is_done IS NOT DISTINCT FROM OLD.is_done THEN
    RETURN NEW;
  END IF;

  SELECT room_number INTO v_room_number
  FROM public.rooms
  WHERE id = NEW.room_id
  LIMIT 1;

  SELECT full_name INTO v_actor_name
  FROM public.staff
  WHERE id = NEW.done_by_staff_id
  LIMIT 1;

  SELECT note INTO v_plan_note
  FROM public.room_cleaning_plans
  WHERE id = NEW.plan_id
  LIMIT 1;

  v_room_note := NEW.note;

  IF NEW.is_done THEN
    v_title := 'Oda temizlendi';
    v_body := format(
      'Oda %s temizlendi. Personel: %s.%s%s',
      coalesce(v_room_number, '?'),
      coalesce(v_actor_name, 'Bilinmiyor'),
      CASE WHEN coalesce(v_plan_note, '') <> '' THEN ' Liste notu: ' || v_plan_note || '.' ELSE '' END,
      CASE WHEN coalesce(v_room_note, '') <> '' THEN ' Oda notu: ' || v_room_note || '.' ELSE '' END
    );
  ELSE
    v_title := 'Oda temizlendi işareti kaldırıldı';
    v_body := format(
      'Oda %s için temizlik işareti kaldırıldı. Personel: %s.',
      coalesce(v_room_number, '?'),
      coalesce(v_actor_name, 'Bilinmiyor')
    );
  END IF;

  INSERT INTO public.notifications (staff_id, title, body, category, notification_type, data)
  SELECT
    s.id,
    v_title,
    v_body,
    'staff',
    'staff_room_cleaning_status',
    jsonb_build_object(
      'url', '/staff/cleaning-plan',
      'planId', NEW.plan_id,
      'planRoomId', NEW.id,
      'roomId', NEW.room_id,
      'roomNumber', v_room_number,
      'isDone', NEW.is_done,
      'doneByStaffId', NEW.done_by_staff_id,
      'doneAt', NEW.done_at,
      'planNote', v_plan_note,
      'roomNote', v_room_note
    )
  FROM public.staff s
  WHERE s.is_active = true;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_room_cleaning_notify_status ON public.room_cleaning_plan_rooms;
CREATE TRIGGER trg_room_cleaning_notify_status
  AFTER UPDATE OF is_done ON public.room_cleaning_plan_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_room_cleaning_status_change();

ALTER TABLE public.room_cleaning_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_cleaning_plan_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_cleaning_plan_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "room_cleaning_plans_select_authenticated" ON public.room_cleaning_plans;
CREATE POLICY "room_cleaning_plans_select_authenticated" ON public.room_cleaning_plans
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "room_cleaning_plans_insert_admin_or_perm" ON public.room_cleaning_plans;
CREATE POLICY "room_cleaning_plans_insert_admin_or_perm" ON public.room_cleaning_plans
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_is_staff_admin()
    OR public.staff_has_app_permission('yarin_oda_temizlik_listesi')
  );

DROP POLICY IF EXISTS "room_cleaning_plans_update_admin_or_perm" ON public.room_cleaning_plans;
CREATE POLICY "room_cleaning_plans_update_admin_or_perm" ON public.room_cleaning_plans
  FOR UPDATE TO authenticated
  USING (
    public.current_user_is_staff_admin()
    OR public.staff_has_app_permission('yarin_oda_temizlik_listesi')
  )
  WITH CHECK (
    public.current_user_is_staff_admin()
    OR public.staff_has_app_permission('yarin_oda_temizlik_listesi')
  );

DROP POLICY IF EXISTS "room_cleaning_plans_delete_admin_or_perm" ON public.room_cleaning_plans;
CREATE POLICY "room_cleaning_plans_delete_admin_or_perm" ON public.room_cleaning_plans
  FOR DELETE TO authenticated
  USING (
    public.current_user_is_staff_admin()
    OR public.staff_has_app_permission('yarin_oda_temizlik_listesi')
  );

DROP POLICY IF EXISTS "room_cleaning_plan_rooms_select_authenticated" ON public.room_cleaning_plan_rooms;
CREATE POLICY "room_cleaning_plan_rooms_select_authenticated" ON public.room_cleaning_plan_rooms
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "room_cleaning_plan_rooms_insert_admin_or_perm" ON public.room_cleaning_plan_rooms;
CREATE POLICY "room_cleaning_plan_rooms_insert_admin_or_perm" ON public.room_cleaning_plan_rooms
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_is_staff_admin()
    OR public.staff_has_app_permission('yarin_oda_temizlik_listesi')
  );

DROP POLICY IF EXISTS "room_cleaning_plan_rooms_update_admin_or_assignee" ON public.room_cleaning_plan_rooms;
CREATE POLICY "room_cleaning_plan_rooms_update_admin_or_assignee" ON public.room_cleaning_plan_rooms
  FOR UPDATE TO authenticated
  USING (
    public.current_user_is_staff_admin()
    OR public.staff_has_app_permission('yarin_oda_temizlik_listesi')
    OR EXISTS (
      SELECT 1
      FROM public.room_cleaning_plan_assignments a
      WHERE a.plan_id = room_cleaning_plan_rooms.plan_id
        AND a.staff_id = public.current_staff_id()
    )
  )
  WITH CHECK (
    public.current_user_is_staff_admin()
    OR public.staff_has_app_permission('yarin_oda_temizlik_listesi')
    OR EXISTS (
      SELECT 1
      FROM public.room_cleaning_plan_assignments a
      WHERE a.plan_id = room_cleaning_plan_rooms.plan_id
        AND a.staff_id = public.current_staff_id()
    )
  );

DROP POLICY IF EXISTS "room_cleaning_plan_rooms_delete_admin_or_perm" ON public.room_cleaning_plan_rooms;
CREATE POLICY "room_cleaning_plan_rooms_delete_admin_or_perm" ON public.room_cleaning_plan_rooms
  FOR DELETE TO authenticated
  USING (
    public.current_user_is_staff_admin()
    OR public.staff_has_app_permission('yarin_oda_temizlik_listesi')
  );

DROP POLICY IF EXISTS "room_cleaning_plan_assignments_select_authenticated" ON public.room_cleaning_plan_assignments;
CREATE POLICY "room_cleaning_plan_assignments_select_authenticated" ON public.room_cleaning_plan_assignments
  FOR SELECT TO authenticated
  USING (
    public.current_user_is_staff_admin()
    OR public.staff_has_app_permission('yarin_oda_temizlik_listesi')
    OR staff_id = public.current_staff_id()
  );

DROP POLICY IF EXISTS "room_cleaning_plan_assignments_insert_admin_or_perm" ON public.room_cleaning_plan_assignments;
CREATE POLICY "room_cleaning_plan_assignments_insert_admin_or_perm" ON public.room_cleaning_plan_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_is_staff_admin()
    OR public.staff_has_app_permission('yarin_oda_temizlik_listesi')
  );

DROP POLICY IF EXISTS "room_cleaning_plan_assignments_update_admin_or_self" ON public.room_cleaning_plan_assignments;
CREATE POLICY "room_cleaning_plan_assignments_update_admin_or_self" ON public.room_cleaning_plan_assignments
  FOR UPDATE TO authenticated
  USING (
    public.current_user_is_staff_admin()
    OR public.staff_has_app_permission('yarin_oda_temizlik_listesi')
    OR staff_id = public.current_staff_id()
  )
  WITH CHECK (
    public.current_user_is_staff_admin()
    OR public.staff_has_app_permission('yarin_oda_temizlik_listesi')
    OR staff_id = public.current_staff_id()
  );

DROP POLICY IF EXISTS "room_cleaning_plan_assignments_delete_admin_or_perm" ON public.room_cleaning_plan_assignments;
CREATE POLICY "room_cleaning_plan_assignments_delete_admin_or_perm" ON public.room_cleaning_plan_assignments
  FOR DELETE TO authenticated
  USING (
    public.current_user_is_staff_admin()
    OR public.staff_has_app_permission('yarin_oda_temizlik_listesi')
  );

COMMIT;
