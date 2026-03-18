-- Mevcut admin kullanıcılarını admin_auth_ids ile senkronize et (RLS contract_acceptances için gerekli)
INSERT INTO public.admin_auth_ids (auth_id)
SELECT auth_id FROM public.staff WHERE role = 'admin' AND auth_id IS NOT NULL
ON CONFLICT (auth_id) DO NOTHING;
