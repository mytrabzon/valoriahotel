-- 1) staff_applications: Sadece giriş yapmış personel (staff) listeleyebilsin (onay bekleyenler görünsün)
DROP POLICY IF EXISTS "staff_applications_staff_select" ON public.staff_applications;
CREATE POLICY "staff_applications_staff_select" ON public.staff_applications
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.staff s WHERE s.auth_id = auth.uid() AND s.is_active = true)
  );

-- 2) "Tüm Çalışanlar" grup sohbeti: Tek bir grup, tüm aktif personel otomatik katılımcı
INSERT INTO public.conversations (id, type, name, created_at, updated_at)
SELECT gen_random_uuid(), 'group', 'Tüm Çalışanlar', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM public.conversations WHERE type = 'group' AND name = 'Tüm Çalışanlar');

-- Mevcut tüm aktif personeli bu sohbete ekle
INSERT INTO public.conversation_participants (conversation_id, participant_id, participant_type)
SELECT c.id, s.id, 'staff'
FROM public.conversations c
CROSS JOIN public.staff s
WHERE c.type = 'group' AND c.name = 'Tüm Çalışanlar' AND s.is_active = true
ON CONFLICT (conversation_id, participant_id, participant_type) DO NOTHING;

-- Yeni eklenen veya tekrar aktif edilen personeli otomatik ekle
CREATE OR REPLACE FUNCTION public.add_staff_to_all_staff_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  IF NEW.is_active = true THEN
    SELECT id INTO v_conv_id FROM public.conversations WHERE type = 'group' AND name = 'Tüm Çalışanlar' LIMIT 1;
    IF v_conv_id IS NOT NULL THEN
      INSERT INTO public.conversation_participants (conversation_id, participant_id, participant_type)
      VALUES (v_conv_id, NEW.id, 'staff')
      ON CONFLICT (conversation_id, participant_id, participant_type) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_staff_to_all_staff_conversation ON public.staff;
CREATE TRIGGER trg_add_staff_to_all_staff_conversation
  AFTER INSERT OR UPDATE OF is_active ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION public.add_staff_to_all_staff_conversation();
