import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

type State = {
  /** Toplam uyarı sayısı: stok onay bekleyen + personel başvuru bekleyen + şikayet bekleyen + çalışan atanmamış sözleşme onayı */
  count: number;
  refresh: (staffId: string) => Promise<void>;
};

export const useAdminWarningStore = create<State>((set) => ({
  count: 0,
  refresh: async (staffId: string) => {
    try {
      const [
        stockRes,
        staffPendingRes,
        reportsRes,
        acceptancesRes,
        unreadRes,
      ] = await Promise.all([
        supabase.from('stock_movements').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('staff_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('feed_post_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('contract_acceptances').select('id', { count: 'exact', head: true }).is('assigned_staff_id', null),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('staff_id', staffId).is('read_at', null),
      ]);
      const total =
        (stockRes.count ?? 0) +
        (staffPendingRes.count ?? 0) +
        (reportsRes.count ?? 0) +
        (acceptancesRes.count ?? 0) +
        (unreadRes.count ?? 0);
      set({ count: total });
    } catch {
      set({ count: 0 });
    }
  },
}));
