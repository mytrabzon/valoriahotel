-- conversation_participants RLS recursion (42P17) düzeltmesi.
-- Policy içinde conversation_participants tekrar okunuyordu -> sonsuz özyineleme.
-- Çözüm: SECURITY DEFINER fonksiyon ile "bu kullanıcı bu konuşmada mı?" kontrolü (RLS bypass).

CREATE OR REPLACE FUNCTION public.current_user_is_staff_in_conversation(p_conv_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    JOIN public.staff s ON s.id = cp.participant_id AND cp.participant_type IN ('staff', 'admin')
    WHERE cp.conversation_id = p_conv_id AND cp.left_at IS NULL AND s.auth_id = auth.uid()
  );
$$;

-- SELECT: Kendi satırım veya aynı konuşmada yer alıyorum (recursion yok)
DROP POLICY IF EXISTS "conv_participants_staff" ON public.conversation_participants;
CREATE POLICY "conv_participants_staff" ON public.conversation_participants
  FOR SELECT TO authenticated
  USING (
    (participant_type IN ('staff', 'admin') AND participant_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid()))
    OR public.current_user_is_staff_in_conversation(conversation_id)
  );

-- INSERT: Staff isem ve ya kendimi ekliyorum ya da zaten katıldığım bir konuşmaya ekleme yapıyorum (recursion yok)
DROP POLICY IF EXISTS "conv_participants_staff_insert" ON public.conversation_participants;
CREATE POLICY "conv_participants_staff_insert" ON public.conversation_participants
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.staff s WHERE s.auth_id = auth.uid())
    AND (
      (participant_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid()) AND participant_type IN ('staff', 'admin'))
      OR public.current_user_is_staff_in_conversation(conversation_id)
    )
  );
