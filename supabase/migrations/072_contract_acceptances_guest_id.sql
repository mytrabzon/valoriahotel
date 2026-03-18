-- Sözleşmeyi imzalayan misafiri contract_acceptances ile eşleştirmek için guest_id
ALTER TABLE public.contract_acceptances
ADD COLUMN IF NOT EXISTS guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contract_acceptances_guest ON public.contract_acceptances(guest_id);

COMMENT ON COLUMN public.contract_acceptances.guest_id IS 'Sözleşmeyi imzalayan misafir (önizlemede isim, PDF indirme için).';
