import { useAuthStore } from '@/stores/authStore';
import { canAccessTransferTourManagement } from '@/lib/transferTourPermissions';
import AdminTransferTourHome from '../../admin/transfer-tour/index';
import CustomerTransferTourList from '../../customer/transfer-tour/index';

export default function StaffTransferTourIndex() {
  const staff = useAuthStore((s) => s.staff);
  if (canAccessTransferTourManagement(staff)) {
    return <AdminTransferTourHome />;
  }
  return <CustomerTransferTourList guestDetailStack="staff" />;
}
