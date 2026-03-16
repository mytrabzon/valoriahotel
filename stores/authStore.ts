import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { log } from '@/lib/logger';
import { savePushTokenForStaff } from '@/lib/notificationsPush';

interface StaffProfile {
  id: string;
  auth_id: string;
  email: string;
  full_name: string | null;
  role: string;
  department: string | null;
}

interface AuthState {
  user: User | null;
  staff: StaffProfile | null;
  loading: boolean;
  setUser: (u: User | null) => void;
  setStaff: (s: StaffProfile | null) => void;
  loadSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  staff: null,
  loading: true,

  setUser: (user) => set({ user }),
  setStaff: (staff) => set({ staff }),

  loadSession: async () => {
    set({ loading: true });
    log.info('authStore', 'loadSession başladı');
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        log.error('authStore', 'getSession hatası', sessionError);
        set({ user: null, staff: null, loading: false });
        return;
      }
      const user = session?.user ?? null;
      log.info('authStore', 'session', { hasUser: !!user, userId: user?.id?.slice(0, 8) });

      let staff: StaffProfile | null = null;
      if (user) {
        const { data, error: staffError } = await supabase
          .from('staff')
          .select('id, auth_id, email, full_name, role, department')
          .eq('auth_id', user.id)
          .eq('is_active', true)
            .maybeSingle();
        if (staffError) {
          log.warn('authStore', 'staff fetch hatası (oturum korunur)', staffError.message, staffError.code);
          // Ağ/veritabanı hatası: çıkış yapma, sadece staff null (kullanıcı lobi görür, tekrar girişte session devam eder)
        } else {
          staff = data ?? null;
          // Sadece sorgu başarılı ve personel gerçekten yoksa/pasifse (ban/hesap silme) oturumu kapat
          if (!staff) {
            log.info('authStore', 'staff yok veya pasif, oturum kapatılıyor');
            await supabase.auth.signOut();
            set({ user: null, staff: null, loading: false });
            return;
          }
        }
        if (staff) {
          log.info('authStore', 'staff', { hasStaff: true });
          savePushTokenForStaff(staff.id).catch((e) => log.warn('authStore', 'push token kaydı', e));
        }
      }

      set({ user, staff, loading: false });
      log.info('authStore', 'loadSession bitti', { loading: false });
    } catch (e) {
      log.error('authStore', 'loadSession exception', e);
      set({ loading: false });
    }
  },

  signOut: async () => {
    log.info('authStore', 'signOut');
    try {
      await supabase.auth.signOut();
      set({ user: null, staff: null });
    } catch (e) {
      log.error('authStore', 'signOut hatası', e);
    }
  },
}));

/** Uygulama açılışında bir kez çağır: auth state dinleyicisi + ilk oturum yüklemesi. Kalıcı oturum için. */
export function initAuthListener() {
  const { loadSession } = useAuthStore.getState();
  loadSession();
  return supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      useAuthStore.setState({ user: null, staff: null });
      return;
    }
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      loadSession();
    }
  });
}
