type MrzStaff = {
  role: string;
  kbs_access_enabled?: boolean;
  app_permissions?: Record<string, boolean> | null;
} | null;

/**
 * Pasaport MRZ: Admin çalışan düzenlemede `kbs_mrz_scan` açık olmalı; ayrıca KBS erişimi (ops) kapalı değil.
 */
export function canStaffUseMrzScan(staff: MrzStaff | undefined): boolean {
  if (!staff) return false;
  const perms = staff.app_permissions ?? {};
  if (perms.kbs_mrz_scan !== true) return false;
  if (staff.role === 'admin') return staff.kbs_access_enabled !== false;
  return staff.kbs_access_enabled === true;
}
