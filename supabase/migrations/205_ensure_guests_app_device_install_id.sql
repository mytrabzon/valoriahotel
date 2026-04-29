-- Repair out-of-order deploys: RPC 202/203 references guests.app_device_install_id; 42703 if 202 ALTER never ran.
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS app_device_install_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_guests_app_device_install_id_unique
  ON public.guests (app_device_install_id)
  WHERE app_device_install_id IS NOT NULL AND btrim(app_device_install_id) <> '';
