/**
 * Personel bildirim sayısı: okunmamış bildirim badge'i için.
 * notifications tablosunda staff_id = mevcut personel ve read_at IS NULL sayılır.
 */
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

interface StaffNotificationState {
  unreadCount: number;
  notificationsScreenFocused: boolean;
  setUnreadCount: (n: number) => void;
  setNotificationsScreenFocused: (v: boolean) => void;
  refresh: () => Promise<void>;
}

export const useStaffNotificationStore = create<StaffNotificationState>((set, get) => ({
  unreadCount: 0,
  notificationsScreenFocused: false,

  setUnreadCount: (n) => set({ unreadCount: n }),

  setNotificationsScreenFocused: (v) => set({ notificationsScreenFocused: v }),

  refresh: async () => {
    const staffId = useAuthStore.getState().staff?.id;
    if (!staffId) {
      set({ unreadCount: 0 });
      return;
    }
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('staff_id', staffId)
      .is('read_at', null);
    if (error) {
      set({ unreadCount: 0 });
      return;
    }
    if (get().notificationsScreenFocused) {
      set({ unreadCount: 0 });
    } else {
      set({ unreadCount: count ?? 0 });
    }
  },
}));
