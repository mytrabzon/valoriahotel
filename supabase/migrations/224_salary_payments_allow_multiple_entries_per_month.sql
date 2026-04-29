-- Allow multiple salary/extra salary entries in same month for a staff member.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'salary_payments_staff_id_period_year_period_month_key'
      AND conrelid = 'public.salary_payments'::regclass
  ) THEN
    ALTER TABLE public.salary_payments
      DROP CONSTRAINT salary_payments_staff_id_period_year_period_month_key;
  END IF;
END $$;
