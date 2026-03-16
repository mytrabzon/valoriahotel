/**
 * Misafir mesajlaşma: app_token (check-in sonrası personel tarafından verilir)
 * AsyncStorage ile kalıcı.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'valoria_guest_messaging_token';

interface GuestMessagingState {
  appToken: string | null;
  setAppToken: (token: string | null) => Promise<void>;
  loadStoredToken: () => Promise<void>;
}

export const useGuestMessagingStore = create<GuestMessagingState>((set, get) => ({
  appToken: null,

  setAppToken: async (token) => {
    if (token) await AsyncStorage.setItem(KEY, token);
    else await AsyncStorage.removeItem(KEY);
    set({ appToken: token });
  },

  loadStoredToken: async () => {
    const stored = await AsyncStorage.getItem(KEY);
    set({ appToken: stored });
  },
}));
