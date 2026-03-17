-- staff_reviews eklenince veya silinince staff.average_rating ve staff.total_reviews güncellenir.

CREATE OR REPLACE FUNCTION public.sync_staff_review_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t_staff_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    t_staff_id := OLD.staff_id;
  ELSE
    t_staff_id := NEW.staff_id;
  END IF;

  UPDATE public.staff
  SET
    total_reviews = (SELECT COUNT(*) FROM public.staff_reviews WHERE staff_id = t_staff_id),
    average_rating = (SELECT ROUND(AVG(rating)::numeric, 2) FROM public.staff_reviews WHERE staff_id = t_staff_id)
  WHERE id = t_staff_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_reviews_sync_stats ON public.staff_reviews;
CREATE TRIGGER trg_staff_reviews_sync_stats
  AFTER INSERT OR DELETE ON public.staff_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_staff_review_stats();

-- Mevcut veriler için ilk senkronizasyon (UPDATE tetikleyici tetiklemez, manuel güncelle)
UPDATE public.staff s
SET
  total_reviews = COALESCE((SELECT COUNT(*) FROM public.staff_reviews sr WHERE sr.staff_id = s.id), 0),
  average_rating = COALESCE((SELECT ROUND(AVG(sr.rating)::numeric, 2) FROM public.staff_reviews sr WHERE sr.staff_id = s.id), 0);
