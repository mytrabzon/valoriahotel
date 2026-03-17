-- Paylaşım bildirimleri: misafir (kullanıcı) da bildirebilsin — aynı tablo, reporter_guest_id ile
ALTER TABLE public.feed_post_reports
  ADD COLUMN IF NOT EXISTS reporter_guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL;

ALTER TABLE public.feed_post_reports
  DROP CONSTRAINT IF EXISTS feed_post_reports_reporter_check;

ALTER TABLE public.feed_post_reports
  ALTER COLUMN reporter_staff_id DROP NOT NULL;

ALTER TABLE public.feed_post_reports
  ADD CONSTRAINT feed_post_reports_reporter_check
  CHECK (
    (reporter_staff_id IS NOT NULL AND reporter_guest_id IS NULL) OR
    (reporter_staff_id IS NULL AND reporter_guest_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_feed_post_reports_reporter_guest ON public.feed_post_reports(reporter_guest_id);

COMMENT ON COLUMN public.feed_post_reports.reporter_guest_id IS 'Bildirimi yapan misafir (kullanıcı); staff bildirimi ise NULL.';

-- Misafir app_token ile bildirim gönderme (RLS bypass için RPC)
CREATE OR REPLACE FUNCTION public.report_feed_post_guest(
  p_app_token TEXT,
  p_post_id UUID,
  p_reason TEXT,
  p_details TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest_id UUID;
  v_report_id UUID;
BEGIN
  IF p_app_token IS NULL OR p_app_token = '' OR p_post_id IS NULL OR p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'app_token, post_id ve reason gerekli';
  END IF;

  SELECT id INTO v_guest_id FROM public.guests WHERE app_token = p_app_token LIMIT 1;
  IF v_guest_id IS NULL THEN
    RAISE EXCEPTION 'Geçersiz token';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = p_post_id) THEN
    RAISE EXCEPTION 'Paylaşım bulunamadı';
  END IF;

  INSERT INTO public.feed_post_reports (
    post_id,
    reporter_staff_id,
    reporter_guest_id,
    reason,
    details,
    status
  ) VALUES (
    p_post_id,
    NULL,
    v_guest_id,
    trim(p_reason),
    NULLIF(trim(p_details), ''),
    'pending'
  )
  RETURNING id INTO v_report_id;

  RETURN v_report_id;
END;
$$;

COMMENT ON FUNCTION public.report_feed_post_guest IS 'Misafir (kullanıcı) paylaşım bildirimi; app_token ile doğrulanır.';
