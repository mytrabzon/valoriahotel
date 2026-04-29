BEGIN;

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS emergency_contact2_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact2_phone text,
  ADD COLUMN IF NOT EXISTS previous_work_experience text;

COMMENT ON COLUMN public.staff.emergency_contact2_name IS 'Personel ikinci yakin kisi adi';
COMMENT ON COLUMN public.staff.emergency_contact2_phone IS 'Personel ikinci yakin kisi telefonu';
COMMENT ON COLUMN public.staff.previous_work_experience IS 'Personelin gecmiste calistigi isler / deneyim ozeti';

COMMIT;
