import { supabase } from '@/lib/supabase';

export type StaffProfileVisitRow = {
  id: string;
  visited_at: string;
  visitor_kind: 'staff' | 'guest';
  visitor_name: string | null;
  visitor_photo: string | null;
  /** Personel ziyaretçi için "Hakkında" (bio); misafir için genelde yok. */
  visitor_about?: string | null;
};

export async function recordStaffProfileVisit(viewedStaffId: string): Promise<void> {
  if (!viewedStaffId) return;
  const { error } = await supabase.rpc('record_staff_profile_visit', {
    p_viewed_staff_id: viewedStaffId,
  });
  if (error) {
    console.warn('[recordStaffProfileVisit]', error.message);
  }
}

export async function fetchMyStaffProfileVisits(limit = 100): Promise<{
  rows: StaffProfileVisitRow[];
  error: Error | null;
}> {
  const { data, error } = await supabase.rpc('list_my_staff_profile_visits', {
    p_limit: limit,
  });
  if (error) {
    return { rows: [], error: new Error(error.message) };
  }
  const rows = (Array.isArray(data) ? data : []) as StaffProfileVisitRow[];
  return { rows, error: null };
}
