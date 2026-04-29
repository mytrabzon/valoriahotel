import type { StaffPermissionSlice } from '@/lib/staffPermissions';

export function canManageDiningVenues(staff: StaffPermissionSlice): boolean {
  if (!staff) return false;
  if (staff.role === 'admin') return true;
  return staff.app_permissions?.dining_venues === true;
}

export function canAccessDiningVenuesManagement(staff: StaffPermissionSlice): boolean {
  return canManageDiningVenues(staff);
}
