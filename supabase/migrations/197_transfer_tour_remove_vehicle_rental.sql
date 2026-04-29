-- Drop vehicle_rental service type; use transfer for existing rows
UPDATE public.transfer_services
SET service_type = 'transfer'
WHERE service_type = 'vehicle_rental';

ALTER TABLE public.transfer_services
  DROP CONSTRAINT IF EXISTS transfer_services_service_type_check;

ALTER TABLE public.transfer_services
  ADD CONSTRAINT transfer_services_service_type_check
  CHECK (service_type IN ('transfer', 'tour', 'vip', 'custom_route'));
