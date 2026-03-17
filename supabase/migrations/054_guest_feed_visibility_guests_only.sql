-- Müşteri paylaşımında "kime paylaşılacak" seçeneği: customers (misafir+personel görür) veya guests_only (sadece misafirler).

-- visibility enum'a guests_only ekle
ALTER TABLE public.feed_posts DROP CONSTRAINT IF EXISTS feed_posts_visibility_check;
ALTER TABLE public.feed_posts ADD CONSTRAINT feed_posts_visibility_check
  CHECK (visibility IN ('all_staff', 'my_team', 'managers_only', 'customers', 'guests_only'));

-- Müşteri ana sayfası: customers ve guests_only ikisini de göster
DROP POLICY IF EXISTS "feed_posts_customers" ON public.feed_posts;
CREATE POLICY "feed_posts_customers" ON public.feed_posts FOR SELECT TO authenticated, anon
  USING (visibility = 'customers' OR visibility = 'guests_only');

-- Personel: customers görsün, guests_only görmesin (misafir "sadece misafirler" seçerse)
DROP POLICY IF EXISTS "feed_posts_staff" ON public.feed_posts;
CREATE POLICY "feed_posts_staff" ON public.feed_posts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.auth_id = auth.uid()
      AND (
        visibility = 'all_staff'
        OR (visibility = 'my_team' AND s.department = (SELECT department FROM public.staff WHERE id = feed_posts.staff_id))
        OR (visibility = 'managers_only' AND s.role = 'admin')
        OR visibility = 'customers'
      )
    )
  );

-- Misafir insert: visibility = 'customers' veya 'guests_only' olabilir
DROP POLICY IF EXISTS "feed_posts_insert_guest" ON public.feed_posts;
CREATE POLICY "feed_posts_insert_guest" ON public.feed_posts FOR INSERT TO authenticated
  WITH CHECK (
    staff_id IS NULL
    AND guest_id IS NOT NULL
    AND visibility IN ('customers', 'guests_only')
    AND NOT EXISTS (SELECT 1 FROM public.staff s WHERE s.auth_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.guests g
      WHERE g.id = guest_id
      AND (
        (auth.jwt()->>'email') IS NOT NULL AND trim(auth.jwt()->>'email') <> '' AND lower(trim(g.email)) = lower(trim(auth.jwt()->>'email'))
        OR g.auth_user_id = auth.uid()
      )
    )
  );
