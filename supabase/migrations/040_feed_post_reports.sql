-- Paylaşım (gönderi) bildirimleri / şikayet sistemi — admin panelinde listelenir, 24 saat içinde dönüş
CREATE TABLE IF NOT EXISTS public.feed_post_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  reporter_staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  admin_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_feed_post_reports_post ON public.feed_post_reports(post_id);
CREATE INDEX IF NOT EXISTS idx_feed_post_reports_reporter ON public.feed_post_reports(reporter_staff_id);
CREATE INDEX IF NOT EXISTS idx_feed_post_reports_status ON public.feed_post_reports(status);
CREATE INDEX IF NOT EXISTS idx_feed_post_reports_created ON public.feed_post_reports(created_at DESC);

ALTER TABLE public.feed_post_reports ENABLE ROW LEVEL SECURITY;

-- Personel kendi bildirimini ekleyebilir (INSERT)
DROP POLICY IF EXISTS "feed_post_reports_insert_staff" ON public.feed_post_reports;
CREATE POLICY "feed_post_reports_insert_staff" ON public.feed_post_reports FOR INSERT TO authenticated
  WITH CHECK (
    reporter_staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
  );

-- Admin tüm kayıtları görebilir ve güncelleyebilir (SELECT, UPDATE)
DROP POLICY IF EXISTS "feed_post_reports_admin_all" ON public.feed_post_reports;
CREATE POLICY "feed_post_reports_admin_all" ON public.feed_post_reports FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.staff WHERE auth_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.staff WHERE auth_id = auth.uid() AND role = 'admin')
  );

COMMENT ON TABLE public.feed_post_reports IS 'Personel tarafından bildirilen paylaşımlar; admin 24 saat içinde dönüş yapar.';
