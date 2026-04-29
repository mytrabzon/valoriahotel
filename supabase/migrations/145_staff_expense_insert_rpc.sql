-- Personel harcaması: doğrudan INSERT bazı ortamlarda RLS alt sorgusu / istemci staff_id
-- uyuşmazlığında başarısız olabiliyor. SECURITY DEFINER RPC ile sadece auth.uid() ile
-- eşleşen aktif personel için satır eklenir (upsert_staff_push_token ile aynı kalıp).

CREATE OR REPLACE FUNCTION public.insert_my_staff_expense(
  p_category_id uuid,
  p_expense_date date,
  p_expense_time time,
  p_amount numeric,
  p_payment_type text,
  p_description text,
  p_receipt_image_url text,
  p_tags text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum gerekli';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Geçersiz tutar';
  END IF;

  IF p_payment_type IS NULL OR p_payment_type NOT IN ('cash', 'credit_card', 'company_card') THEN
    RAISE EXCEPTION 'Geçersiz ödeme tipi';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.expense_categories c
    WHERE c.id = p_category_id AND c.is_active = true
  ) THEN
    RAISE EXCEPTION 'Geçersiz veya pasif kategori';
  END IF;

  SELECT s.id INTO v_staff_id
  FROM public.staff s
  WHERE s.auth_id = auth.uid()
    AND s.deleted_at IS NULL
    AND COALESCE(s.is_active, true) = true
  LIMIT 1;

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Personel kaydı bulunamadı veya hesap aktif değil';
  END IF;

  INSERT INTO public.staff_expenses (
    staff_id,
    category_id,
    expense_date,
    expense_time,
    amount,
    payment_type,
    description,
    receipt_image_url,
    tags,
    status
  ) VALUES (
    v_staff_id,
    p_category_id,
    p_expense_date,
    p_expense_time,
    p_amount,
    p_payment_type,
    nullif(trim(COALESCE(p_description, '')), ''),
    p_receipt_image_url,
    p_tags,
    'pending'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.insert_my_staff_expense(uuid, date, time, numeric, text, text, text, text[]) IS
  'Oturumdaki kullanıcı için staff_expenses satırı ekler; staff_id istemciden alınmaz (RLS güvenilirliği).';

GRANT EXECUTE ON FUNCTION public.insert_my_staff_expense(uuid, date, time, numeric, text, text, text, text[]) TO authenticated;
