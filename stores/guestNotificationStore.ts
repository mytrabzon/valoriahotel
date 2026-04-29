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
    const { data, error } = await supabase.rpc('get_guest_notification_summary', { p_app_token: token });
    if (error) {
      const { data: full } = await supabase.rpc('get_guest_notifications', { p_app_token: token });
      const list = (full as { read_at: string | null }[] | null) ?? [];
      const count = list.filter((n) => !n.read_at).length;
      if (get().notificationsScreenFocused) {
        set({ unreadCount: 0 });
      } else {
        set({ unreadCount: count });
      }
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const unread = Number((row as { unread_count?: unknown })?.unread_count ?? 0) || 0;
    if (get().notificationsScreenFocused) {
      set({ unreadCount: 0 });
    } else {
      set({ unreadCount: unread });
    }
  },
}));
