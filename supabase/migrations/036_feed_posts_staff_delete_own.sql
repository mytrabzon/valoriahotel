-- Personel kendi paylaşımını silebilsin (admin zaten feed_posts_admin_all ile silebiliyor)
DROP POLICY IF EXISTS "feed_posts_delete_own" ON public.feed_posts;
CREATE POLICY "feed_posts_delete_own" ON public.feed_posts
  FOR DELETE TO authenticated
  USING (
    staff_id = (SELECT id FROM public.staff WHERE auth_id = auth.uid())
  );
