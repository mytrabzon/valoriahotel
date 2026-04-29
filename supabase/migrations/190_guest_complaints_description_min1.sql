BEGIN;

ALTER TABLE public.guest_complaints
  DROP CONSTRAINT IF EXISTS guest_complaints_description_check;

ALTER TABLE public.guest_complaints
  ADD CONSTRAINT guest_complaints_description_check
  CHECK (char_length(btrim(description)) >= 1);

COMMIT;
