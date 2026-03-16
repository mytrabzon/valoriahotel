import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'valoria_policy_terms_accepted';
const PENDING_GUEST_KEY = 'valoria_pending_guest';

export async function hasPolicyConsent(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v === '1' || v === 'true';
  } catch {
    return false;
  }
}

export async function setPolicyConsent(): Promise<void> {
  await AsyncStorage.setItem(KEY, '1');
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
