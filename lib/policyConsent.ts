import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

const KEY = 'valoria_policy_terms_accepted';
/** auth.users.id — cihazda hesap başına; DB gecikse bile aynı misafir tekrar sözleşme ekranına düşmesin */
const perUserKey = (authUserId: string) => `valoria_policy_accepted_uid:${authUserId}`;
const PENDING_GUEST_KEY = 'valoria_pending_guest';

/**
 * Giriş yapmış kullanıcı: `privacy_consent` satırı var mı? Misafir/cihaz: AsyncStorage.
 * @param knownAuthUserId Açılış yönlendirmesi gibi yerlerde `authStore`’daki `user.id` verilir;
 *  böylece `getUser()` ağ turu atlanır (soğuk açılışta 100–500 ms+ fark edebilir).
 *  Verilmezse `getSession()` ile yerel oturumdan id okunur (`getUser()` gibi ağ yok).
 */
export async function hasPolicyConsent(knownAuthUserId?: string | null): Promise<boolean> {
  try {
    let uid: string | null = null;
    if (typeof knownAuthUserId === 'string' && knownAuthUserId.length > 0) {
      uid = knownAuthUserId;
    } else {
      const { data: { session } } = await supabase.auth.getSession();
      uid = session?.user?.id ?? null;
    }
    if (uid) {
      const localU = await AsyncStorage.getItem(perUserKey(uid));
      if (localU === '1' || localU === 'true') return true;
      const legacy = await AsyncStorage.getItem(KEY);
      if (legacy === '1' || legacy === 'true') {
        await AsyncStorage.setItem(perUserKey(uid), '1').catch(() => {});
        return true;
      }
      const { data, error } = await supabase
        .from('privacy_consent')
        .select('auth_user_id')
        .eq('auth_user_id', uid)
        .maybeSingle();
      if (!error && data) {
        await AsyncStorage.setItem(perUserKey(uid), '1').catch(() => {});
        return true;
      }
      return false;
    }
    const v = await AsyncStorage.getItem(KEY);
    return v === '1' || v === 'true';
  } catch {
    return false;
  }
}

/** Onayı kaydet: giriş yapmış kullanıcı → Supabase; misafir → AsyncStorage. */
export async function setPolicyConsent(): Promise<void> {
  let uid: string | null = null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    uid = user?.id ?? null;
    if (uid) {
      await AsyncStorage.setItem(perUserKey(uid), '1');
    }
    if (user?.id) {
      await supabase.from('privacy_consent').upsert(
        { auth_user_id: user.id, accepted_at: new Date().toISOString() },
        { onConflict: 'auth_user_id' }
      );
    }
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    await AsyncStorage.setItem(KEY, '1');
    if (uid) await AsyncStorage.setItem(perUserKey(uid), '1').catch(() => {});
  }
}

export interface PendingGuest {
  token: string;
  roomId: string;
  roomNumber: string;
}

export async function getPendingGuest(): Promise<PendingGuest | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_GUEST_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as PendingGuest;
    return o?.token && o?.roomId != null ? o : null;
  } catch {
    return null;
  }
}

export async function setPendingGuest(p: PendingGuest): Promise<void> {
  await AsyncStorage.setItem(PENDING_GUEST_KEY, JSON.stringify(p));
}

export async function clearPendingGuest(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_GUEST_KEY);
}
