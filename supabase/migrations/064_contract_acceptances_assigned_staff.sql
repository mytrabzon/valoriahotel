-- Sözleşme onayları: Admin çalışan atar, çalışan oda ataması yapar.
-- - contract_acceptances: assigned_staff_id, assigned_at
-- - RLS: Çalışan sadece kendine atanmış kayıtlarda room_id güncelleyebilir; admin tümünü yönetir.

ALTER TABLE public.contract_acceptances
  ADD COLUMN IF NOT EXISTS assigned_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contract_acceptances_assigned_staff ON public.contract_acceptances(assigned_staff_id);

COMMENT ON COLUMN public.contract_acceptances.assigned_staff_id IS 'Admin tarafından atanan çalışan; bu çalışan oda ataması yapar.';
COMMENT ON COLUMN public.contract_acceptances.assigned_at IS 'Çalışan atanma zamanı.';

-- Mevcut SELECT policy tüm authenticated için; UPDATE ekleyeceğiz.
-- Çalışan: sadece assigned_staff_id = kendi id ise UPDATE (room_id vb.)
-- Admin: tüm satırlarda UPDATE (assigned_staff_id atama dahil)
CREATE OR REPLACE FUNCTION public.contract_acceptances_can_update(p_row public.contract_acceptances)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.auth_id = auth.uid()
      AND (s.role = 'admin' OR p_row.assigned_staff_id = s.id)
  );
$$;

DROP POLICY IF EXISTS "contract_acceptances_update" ON public.contract_acceptances;
CREATE POLICY "contract_acceptances_update"
ON public.contract_acceptances FOR UPDATE TO authenticated
USING (true)
WITH CHECK (public.contract_acceptances_can_update(contract_acceptances));

-- Çalışan sadece kendine atanmış onayları görsün; admin hepsini görsün (SELECT kısıtı)
CREATE OR REPLACE FUNCTION public.current_staff_id_for_acceptances()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.staff WHERE auth_id = auth.uid() LIMIT 1;
$$;

DROP POLICY IF EXISTS "contract_acceptances_read_staff" ON public.contract_acceptances;
CREATE POLICY "contract_acceptances_read_staff"
ON public.contract_acceptances FOR SELECT TO authenticated
USING (
  public.current_user_is_staff_admin()
  OR assigned_staff_id = public.current_staff_id_for_acceptances()
);
