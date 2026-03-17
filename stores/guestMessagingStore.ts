/**
 * Misafir mesajlaşma: app_token giriş yapan kullanıcı için otomatik (e-posta ile guest eşleşir veya oluşturulur).
 * Giriş kodu istenmez. AsyncStorage ile kalıcı.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'valoria_guest_messaging_token';

interface GuestMessagingState {
  appToken: string | null;
  unreadCount: number;
  setAppToken: (token: string | null) => Promise<void>;
  setUnreadCount: (n: number) => void;
  loadStoredToken: () => Promise<void>;
}

export const useGuestMessagingStore = create<GuestMessagingState>((set, get) => ({
  appToken: null,
  unreadCount: 0,

  setAppToken: async (token) => {
    if (token) await AsyncStorage.setItem(KEY, token);
    else await AsyncStorage.removeItem(KEY);
    set({ appToken: token });
  },

  setUnreadCount: (n) => set({ unreadCount: n }),

  loadStoredToken: async () => {
    const stored = await AsyncStorage.getItem(KEY);
    set({ appToken: stored });
  },
}));
