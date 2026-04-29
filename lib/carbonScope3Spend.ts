import { supabase } from '@/lib/supabase';
import { SCOPE3_SPEND_KG_CO2E_PER_TRY_DEFAULT } from '@/lib/carbonConstants';

export type Scope3SpendMonthRow = {
  month_start: string;
  approved_expenses_try: number;
  approved_salary_try: number;
  total_try: number;
  kg_co2e_estimate: number;
  factor_kg_co2e_per_try: number;
  methodology_note: string | null;
};

/**
 * Admin RPC: işletmeye göre ay bazında onaylı harcama + maaş TRY ve spend-based kg CO₂e tahmini.
 */
export async function fetchScope3SpendByYear(year: number): Promise<Scope3SpendMonthRow[]> {
  const { data, error } = await supabase.rpc('admin_scope3_spend_carbon_by_month', {
    p_year: year,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Scope3SpendMonthRow[];
  return rows.map((r) => ({
    ...r,
    factor_kg_co2e_per_try: Number(r.factor_kg_co2e_per_try ?? SCOPE3_SPEND_KG_CO2E_PER_TRY_DEFAULT),
    approved_expenses_try: Number(r.approved_expenses_try ?? 0),
    approved_salary_try: Number(r.approved_salary_try ?? 0),
    total_try: Number(r.total_try ?? 0),
    kg_co2e_estimate: Number(r.kg_co2e_estimate ?? 0),
  }));
}
