-- Görüntüleyen listesi: yalnızca paylaşım sahibi personel (staff_id) okuyabilsin.
-- Misafir: yalnızca kendi paylaşımları için toplam sayı (RPC); satır listesi yok.
-- (Eski) Tüm personelin tüm feed_post_views satırlarını okuması kapatılır.

DROP POLICY IF EXISTS "feed_views_staff" ON public.feed_post_views;
DROP POLICY IF EXISTS "feed_views_guest_select" ON public.feed_post_views;
DROP POLICY IF EXISTS "feed_views_guest_insert" ON public.feed_post_views;
DROP POLICY IF EXISTS "feed_views_staff_select_own_post" ON public.feed_post_views;
DROP POLICY IF EXISTS "feed_views_staff_insert_self" ON public.feed_post_views;

-- Personel: yalnızca kendi staff paylaşımına ait görüntüleme satırlarını oku
CREATE POLICY "feed_views_staff_select_own_post" ON public.feed_post_views
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff s
      JOIN public.feed_posts fp ON fp.id = feed_post_views.post_id
      WHERE s.auth_id = auth.uid()
        AND fp.staff_id = s.id
    )
  );

-- Personel: kendi adına görüntüleme kaydı ekle
CREATE POLICY "feed_views_staff_insert_self" ON public.feed_post_views
  FOR INSERT TO authenticated
  WITH CHECK (
    staff_id IS NOT NULL
    AND guest_id IS NULL
    AND staff_id = (SELECT id FROM public.staff WHERE auth_id = auth.uid() LIMIT 1)
    AND EXISTS (SELECT 1 FROM public.feed_posts fp WHERE fp.id = post_id)
  );

CREATE POLICY "feed_views_guest_insert" ON public.feed_post_views
  FOR INSERT TO authenticated
  WITH CHECK (
    guest_id IS NOT NULL AND staff_id IS NULL
    AND EXISTS (SELECT 1 FROM public.guests g WHERE g.id = guest_id AND g.auth_user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.feed_posts fp WHERE fp.id = post_id AND fp.visibility = 'customers')
  );

-- Misafir: feed_post_views satırı okuma yok; sayı get_my_guest_feed_post_view_counts ile

-- Misafir: kendi paylaşımları için görüntülenme sayısı
CREATE OR REPLACE FUNCTION public.get_my_guest_feed_post_view_counts(p_post_ids uuid[])
RETURNS TABLE(post_id uuid, view_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest_id uuid;
BEGIN
  SELECT g.id INTO v_guest_id
  FROM public.guests g
  WHERE g.auth_user_id = auth.uid()
  LIMIT 1;

  IF v_guest_id IS NULL THEN
    RAISE EXCEPTION 'not a guest' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT v.post_id, count(*)::bigint
  FROM public.feed_post_views v
  INNER JOIN public.feed_posts fp ON fp.id = v.post_id AND fp.guest_id = v_guest_id
  WHERE v.post_id = ANY(p_post_ids)
  GROUP BY v.post_id;
END;
$$;

COMMENT ON FUNCTION public.get_my_guest_feed_post_view_counts(uuid[]) IS
  'Misafir: yalnızca kendi (guest) paylaşımlarının toplam görüntülenme sayısı; kimler gördü dönmez.';

GRANT EXECUTE ON FUNCTION public.get_my_guest_feed_post_view_counts(uuid[]) TO authenticated;
