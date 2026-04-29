BEGIN;

ALTER TABLE public.guest_complaints
  DROP CONSTRAINT IF EXISTS guest_complaints_status_check;

ALTER TABLE public.guest_complaints
  ADD CONSTRAINT guest_complaints_status_check
  CHECK (
    status IN (
      'pending',
      'reviewing',
      'taken_for_review',
      'solution_in_progress',
      'resolved',
      'rejected',
      'unresolved'
    )
  );

COMMIT;
