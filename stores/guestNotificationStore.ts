/**
 * Misafir bildirim sayısı: okunmamış bildirim badge'i için.
 * get_guest_notifications ile liste alınıp okunmamış sayılıyor.
 */
import { create } from 'zustand';
import { getGuestNotificationToken } from '@/lib/guestNotificationToken';
import { supabase } from '@/lib/supabase';

interface GuestNotificationState {
  unreadCount: number;
  notificationsScreenFocused: boolean;
  setUnreadCount: (n: number) => void;
  setNotificationsScreenFocused: (v: boolean) => void;
  refresh: () => Promise<void>;
}

export const useGuestNotificationStore = create<GuestNotificationState>((set, get) => ({
  unreadCount: 0,
  notificationsScreenFocused: false,

  setUnreadCount: (n) => set({ unreadCount: n }),

  setNotificationsScreenFocused: (v) => set({ notificationsScreenFocused: v }),

  refresh: async () => {
    const token = await getGuestNotificationToken();
    if (!token) {
      set({ unreadCount: 0 });
      return;
    }
    const { data } = await supabase.rpc('get_guest_notifications', { p_app_token: token });
    const list = (data as { read_at: string | null }[] | null) ?? [];
    const count = list.filter((n) => !n.read_at).length;
    if (get().notificationsScreenFocused) {
      set({ unreadCount: 0 });
    } else {
      set({ unreadCount: count });
    }
  },
}));
