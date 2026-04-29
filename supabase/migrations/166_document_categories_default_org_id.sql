-- Ensure organization_id is always set for public.document_categories inserts.
-- This prevents NOT NULL violations when client omits organization_id.

BEGIN;

CREATE OR REPLACE FUNCTION public.set_document_categories_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.current_staff_organization_id();
  END IF;

  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required (could not infer from current staff)';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_categories_defaults ON public.document_categories;
CREATE TRIGGER trg_document_categories_defaults
BEFORE INSERT ON public.document_categories
FOR EACH ROW
EXECUTE FUNCTION public.set_document_categories_defaults();

-- Also set a DEFAULT so inserts without trigger context still behave.
ALTER TABLE public.document_categories
  ALTER COLUMN organization_id SET DEFAULT public.current_staff_organization_id();

COMMIT;

