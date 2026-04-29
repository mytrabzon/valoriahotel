import type { StaffPermissionSlice } from '@/lib/staffPermissions';

/** Hizmet CRUD, fotoğraflar, aktif/pasif */
export function canManageTransferServices(staff: StaffPermissionSlice): boolean {
  if (!staff) return false;
  if (staff.role === 'admin') return true;
  return staff.app_permissions?.transfer_tour_services === true;
}

/** Talep listesi, onay/red, fiyat teklifi, tamamlandı */
export function canManageTransferRequests(staff: StaffPermissionSlice): boolean {
  if (!staff) return false;
  if (staff.role === 'admin') return true;
  return staff.app_permissions?.transfer_tour_requests === true;
}

/** Modüle herhangi bir yönetim erişimi */
export function canAccessTransferTourManagement(staff: StaffPermissionSlice): boolean {
  return canManageTransferServices(staff) || canManageTransferRequests(staff);
}
