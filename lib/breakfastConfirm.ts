/**
 * Kahvaltı Teyit Kaydı — ayarlar ve istemci tarafı uygunluk (asıl kural DB tetikleyici + RLS).
 */

import { supabase } from '@/lib/supabase';
import type { StaffPermissionSlice } from '@/lib/staffPermissions';

export const BREAKFAST_DEPARTMENTS = new Set(['kitchen', 'restaurant']);

/** JSONB / cache kaynaklı `true`, `"true"`, `1` değerlerini kabul et (staff.app_permissions). */
export function appPermissionTruthy(perms: Record<string, unknown> | null | undefined, key: string): boolean {
  if (!perms || typeof perms !== 'object' || Array.isArray(perms)) return false;
  const v = perms[key];
  if (v === true) return true;
  if (v === false || v == null) return false;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === 'true' || s === 't' || s === '1' || s === 'yes';
  }
  if (typeof v === 'number') return v === 1;
  return false;
}

export type BreakfastConfirmationSettings = {
  organization_id: string;
  feature_enabled: boolean;
  min_photos: number;
  max_photos: number;
  guest_count_required: boolean;
  note_required: boolean;
  daily_record_limit: number;
  submission_time_start: string | null;
  submission_time_end: string | null;
  require_kitchen_department: boolean;
};

export type BreakfastConfirmationRow = {
  id: string;
  organization_id: string;
  staff_id: string;
  record_date: string;
  guest_count: number;
  note: string | null;
  photo_urls: string[];
  submitted_at: string;
  approved_at: string | null;
  approved_by_staff_id: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchBreakfastSettings(organizationId: string): Promise<BreakfastConfirmationSettings | null> {
  const { data, error } = await supabase
    .from('breakfast_confirmation_settings')
    .select(
      'organization_id, feature_enabled, min_photos, max_photos, guest_count_required, note_required, daily_record_limit, submission_time_start, submission_time_end, require_kitchen_department'
    )
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error || !data) return null;
  return data as BreakfastConfirmationSettings;
}

/** Personel: teyit ekranına girip kayıt oluşturma (admin personel uygulamasında nadiren). */
export function canBreakfastSubmitUi(
  staff: StaffPermissionSlice,
  settings: BreakfastConfirmationSettings | null
): boolean {
  if (!staff) return false;
  if (!settings?.feature_enabled) return false;
  if (staff.role === 'admin') return true;
  if (!appPermissionTruthy(staff.app_permissions as Record<string, unknown> | undefined, 'kahvalti_teyit_olustur')) return false;
  if (settings.require_kitchen_department) {
    const d = staff.department ?? '';
    if (!BREAKFAST_DEPARTMENTS.has(d)) return false;
  }
  return true;
}

/** Menüde kahvaltı modülü (oluştur / departman / onay / rapor) görünsün mü */
export function canSeeBreakfastModule(staff: StaffPermissionSlice): boolean {
  if (!staff) return false;
  if (staff.role === 'admin') return false;
  const p = staff.app_permissions as Record<string, unknown> | undefined;
  return (
    appPermissionTruthy(p, 'kahvalti_teyit_olustur') ||
    appPermissionTruthy(p, 'kahvalti_teyit_departman') ||
    appPermissionTruthy(p, 'kahvalti_teyit_onayla') ||
    appPermissionTruthy(p, 'kahvalti_rapor')
  );
}

export function canBreakfastApproveUi(staff: StaffPermissionSlice): boolean {
  if (!staff) return false;
  return (
    staff.role === 'admin' ||
    appPermissionTruthy(staff.app_permissions as Record<string, unknown> | undefined, 'kahvalti_teyit_onayla')
  );
}

export function canBreakfastDepartmentViewUi(staff: StaffPermissionSlice): boolean {
  if (!staff) return false;
  if (staff.role === 'admin') return true;
  return appPermissionTruthy(staff.app_permissions as Record<string, unknown> | undefined, 'kahvalti_teyit_departman');
}
