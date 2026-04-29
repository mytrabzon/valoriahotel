-- Restoran / mekan logosu: harita pini, liste avatarı (kapaktan ayrı)

BEGIN;

ALTER TABLE public.dining_venues
  ADD COLUMN IF NOT EXISTS logo_url text;

COMMIT;
