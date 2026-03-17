import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

const KEY = 'valoria_policy_terms_accepted';
const PENDING_GUEST_KEY = 'valoria_pending_guest';

/** Giriş yapmış kullanıcı: Supabase’te kayıt var mı? Misafir/cihaz: AsyncStorage. */
export async function hasPolicyConsent(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      const { data, error } = await supabase
        .from('privacy_consent')
        .select('auth_user_id')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      if (!error && data) return true;
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
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      await supabase.from('privacy_consent').upsert(
        { auth_user_id: user.id, accepted_at: new Date().toISOString() },
        { onConflict: 'auth_user_id' }
      );
    }
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    await AsyncStorage.setItem(KEY, '1');
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
