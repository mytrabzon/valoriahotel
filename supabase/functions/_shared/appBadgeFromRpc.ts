/**
 * Simge rozeti: app_badge_total_* (migration 177). RPC yok veya hata → 1
 * Expo/ APNs: badge 0 = rozeti siler; arka planda yeni bildirimde sayaç görmek için 1+ gerekir.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Push payload (Expo) ve data.app_badge için 1..999 — 0/ geçersiz → 1 */
export function iconBadgeForPush(n: number): number {
  const v = Math.trunc(Number(n));
  if (!Number.isFinite(v) || v < 1) return 1;
  if (v > 999) return 999;
  return v;
}

export async function fetchAppIconBadgeForStaff(
  supabase: SupabaseClient,
  staffId: string
): Promise<number> {
  const { data, error } = await supabase.rpc("app_badge_total_for_staff", { p_staff_id: staffId });
  if (!error && data != null) {
    return iconBadgeForPush(Number(data));
  }
  return 1;
}

export async function fetchAppIconBadgeForGuest(
  supabase: SupabaseClient,
  guestId: string
): Promise<number> {
  const { data, error } = await supabase.rpc("app_badge_total_for_guest", { p_guest_id: guestId });
  if (!error && data != null) {
    return iconBadgeForPush(Number(data));
  }
  return 1;
}
