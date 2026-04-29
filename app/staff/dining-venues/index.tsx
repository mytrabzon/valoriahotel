import { useAuthStore } from '@/stores/authStore';
import { canAccessDiningVenuesManagement } from '@/lib/diningVenuesPermissions';
import AdminDiningVenuesIndex from '../../admin/dining-venues/index';
import CustomerDiningVenuesList from '../../customer/dining-venues/index';

export default function StaffDiningVenuesIndex() {
  const staff = useAuthStore((s) => s.staff);
  if (canAccessDiningVenuesManagement(staff)) {
    return <AdminDiningVenuesIndex />;
  }
  return <CustomerDiningVenuesList guestDetailStack="staff" />;
}
