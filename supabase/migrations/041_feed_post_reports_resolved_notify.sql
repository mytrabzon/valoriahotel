-- Şikayet durumuna 'çözüldü' ekle; bildiren personel yapılan işlemden haberdar edilecek (uygulama tarafında notification insert)
ALTER TABLE public.feed_post_reports
  DROP CONSTRAINT IF EXISTS feed_post_reports_status_check;

ALTER TABLE public.feed_post_reports
  ADD CONSTRAINT feed_post_reports_status_check
  CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed'));

COMMENT ON COLUMN public.feed_post_reports.status IS 'pending=beklemede, reviewed=incelendi, resolved=çözüldü, dismissed=reddedildi';
