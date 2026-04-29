import Constants from 'expo-constants';

function parseBool(s: string | undefined): boolean | undefined {
  if (s === undefined || s === '') return undefined;
  const t = s.toLowerCase().trim();
  if (t === 'true' || t === '1' || t === 'yes') return true;
  if (t === 'false' || t === '0' || t === 'no') return false;
  return undefined;
}

/**
 * KBS personel sekmesi + admin KBS menüleri. Varsayılan: kapalı (altyapı hazır olana kadar).
 * Açmak için: EXPO_PUBLIC_KBS_UI_ENABLED=true (.env veya EAS secret)
 */
export function isKbsUiEnabled(): boolean {
  const fromEnv = parseBool(process.env.EXPO_PUBLIC_KBS_UI_ENABLED);
  if (fromEnv !== undefined) return fromEnv;
  const extra = Constants.expoConfig?.extra as { public?: { kbsUiEnabled?: string | boolean } } | undefined;
  const e = extra?.public?.kbsUiEnabled;
  if (typeof e === 'boolean') return e;
  if (typeof e === 'string') {
    const p = parseBool(e);
    if (p !== undefined) return p;
  }
  return false;
}
