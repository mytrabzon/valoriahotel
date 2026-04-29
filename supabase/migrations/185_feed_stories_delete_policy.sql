-- Story silme islemi RLS update(new row) checkine takildiginda
-- owner/admin icin dogrudan DELETE izni ver.

ALTER TABLE public.feed_stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feed_stories_staff_hard_delete_own_or_admin" ON public.feed_stories;
CREATE POLICY "feed_stories_staff_hard_delete_own_or_admin"
  ON public.feed_stories
  FOR DELETE
  TO authenticated
  USING (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.staff s WHERE s.auth_id = auth.uid() AND s.role = 'admin')
  );
