-- Müşteri/misafir sadece visibility = 'customers' olan gönderileri görsün.
-- all_staff, my_team, managers_only seçilse bile müşteri/misafir tarafında görünmesin.
-- RESTRICTIVE policy: Staff olmayan authenticated kullanıcı yalnızca visibility = 'customers' satırlarını görebilir.

DROP POLICY IF EXISTS "feed_posts_restrict_non_staff" ON public.feed_posts;
CREATE POLICY "feed_posts_restrict_non_staff" ON public.feed_posts
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    visibility = 'customers'
    OR EXISTS (SELECT 1 FROM public.staff WHERE auth_id = auth.uid())
  );

COMMENT ON POLICY "feed_posts_restrict_non_staff" ON public.feed_posts IS
  'Staff olmayan kullanıcılar sadece visibility=customers gönderileri görebilir; all_staff/my_team/managers_only müşteri/misafirde görünmez.';
