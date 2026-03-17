-- Resepsiyon tek QR için varsayılan token: link hemen çalışsın.
-- URL: .../public-contract?token=valoria-resepsiyon-qr&lang=tr
INSERT INTO public.contract_lobby_tokens (token, expires_at)
VALUES ('valoria-resepsiyon-qr', now() + interval '2 years')
ON CONFLICT (token) DO UPDATE SET expires_at = now() + interval '2 years';

COMMENT ON TABLE public.contract_lobby_tokens IS 'Tek QR sözleşme onayı için token; oda bağlı değil. Varsayılan: valoria-resepsiyon-qr (2 yıl).';
