-- Scope 3 (harcama bazlı) kabullü tahmin: onaylı personel harcaması + onaylı maaş (TRY) × tek çarpan.
-- Ana tesis karbonu (elektrik/su/gaz/atık) ile karıştırılmamalı; raporda ayrı blok olarak sunulur.

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_scope3_spend_carbon_by_month(p_year INTEGER)
RETURNS TABLE (
  month_start DATE,
  approved_expenses_try NUMERIC,
  approved_salary_try NUMERIC,
  total_try NUMERIC,
  kg_co2e_estimate NUMERIC,
  factor_kg_co2e_per_try NUMERIC,
  methodology_note TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
  v_factor CONSTANT NUMERIC := 0.00035;
  -- Kabullü tek çarpan (kg CO₂e / TRY): harcama bazlı (spend-based) gösterim; kurumsal rapor veya
  -- GHG Protocol uyumluluğu için kurum içi veya sektörel faktör ile değiştirilmelidir.
  m INT;
  v_exp NUMERIC;
  v_sal NUMERIC;
  v_total NUMERIC;
BEGIN
  IF p_year IS NULL OR p_year < 2000 OR p_year > 2100 THEN
    RAISE EXCEPTION 'Invalid year';
  END IF;

  SELECT s.organization_id INTO v_org
  FROM public.staff s
  WHERE s.auth_id = auth.uid()
    AND s.role = 'admin'
    AND s.is_active = true
    AND (s.deleted_at IS NULL)
  LIMIT 1;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Unauthorized or organization not found';
  END IF;

  FOR m IN 1..12 LOOP
    SELECT COALESCE(SUM(e.amount), 0) INTO v_exp
    FROM public.staff_expenses e
    WHERE e.organization_id = v_org
      AND e.status = 'approved'
      AND EXTRACT(YEAR FROM e.expense_date)::INT = p_year
      AND EXTRACT(MONTH FROM e.expense_date)::INT = m;

    SELECT COALESCE(SUM(sp.amount), 0) INTO v_sal
    FROM public.salary_payments sp
    INNER JOIN public.staff st ON st.id = sp.staff_id
    WHERE st.organization_id = v_org
      AND sp.status = 'approved'
      AND sp.period_year = p_year
      AND sp.period_month = m;

    v_total := v_exp + v_sal;
    month_start := make_date(p_year, m, 1);
    approved_expenses_try := ROUND(v_exp, 2);
    approved_salary_try := ROUND(v_sal, 2);
    total_try := ROUND(v_total, 2);
    factor_kg_co2e_per_try := v_factor;
    kg_co2e_estimate := ROUND(v_total * v_factor, 2);
    methodology_note :=
      'Onaylı personel harcamaları (expense_date) + onaylı maaş (dönem ayı) toplam TRY × '
      || v_factor::TEXT
      || ' kg CO₂e/TRY. Kabullü gösterim; tesis aktivite tabanlı CO₂ ile toplanmaz.';
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.admin_scope3_spend_carbon_by_month(INTEGER) IS
  'Admin: işletmeye göre ay bazında onaylı harcama+maaş TRY ve spend-based kg CO₂e tahmini. SECURITY DEFINER; yalnızca admin.';

REVOKE ALL ON FUNCTION public.admin_scope3_spend_carbon_by_month(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_scope3_spend_carbon_by_month(INTEGER) TO authenticated;

COMMIT;
