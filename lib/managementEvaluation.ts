/** Yönetim personel değerlendirmesi (staff_management_evaluations) — alan anahtarları ve yardımcılar */

export const MGMT_EVAL_STAR_KEYS = [
  'star_teamwork',
  'star_discipline',
  'star_job_skills',
  'star_respect_peers',
  'star_rule_compliance',
  'star_communication',
  'star_initiative',
  'star_guest_focus',
  'star_punctuality',
] as const;

export type MgmtEvalStarKey = (typeof MGMT_EVAL_STAR_KEYS)[number];

export type StaffManagementEvaluationRow = {
  id: string;
  staff_id: string;
  evaluator_staff_id: string;
  created_at: string;
  updated_at: string;
  period_title: string | null;
  period_start: string | null;
  period_end: string | null;
  star_teamwork: number;
  star_discipline: number;
  star_job_skills: number;
  star_respect_peers: number;
  star_rule_compliance: number;
  star_communication: number;
  star_initiative: number;
  star_guest_focus: number;
  star_punctuality: number;
  overall_star_avg: number | string | null;
  manager_comment: string | null;
  staff_acknowledged_at: string | null;
  extra_stars?: Record<string, number> | null;
};

export function parseOverallAvg(v: StaffManagementEvaluationRow['overall_star_avg']): number | null {
  if (v == null) return null;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function starsText(n: number, max = 5): string {
  const r = Math.max(0, Math.min(max, Math.round(n)));
  return '★'.repeat(r) + '☆'.repeat(max - r);
}

export function defaultMgmtEvalStars(): Record<MgmtEvalStarKey, number> {
  const o = {} as Record<MgmtEvalStarKey, number>;
  for (const k of MGMT_EVAL_STAR_KEYS) o[k] = 3;
  return o;
}
