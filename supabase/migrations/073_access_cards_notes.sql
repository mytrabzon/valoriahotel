-- Kart tanımlama: not alanı (açıklama, RFID formatı, tedarikçi vb.)
ALTER TABLE public.access_cards
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.access_cards.notes IS 'Kart notu: format, tedarikçi, kullanım amacı vb.';
