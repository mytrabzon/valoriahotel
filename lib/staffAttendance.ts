import { supabase } from '@/lib/supabase';

export type AttendanceEventType =
  | 'check_in'
  | 'check_out'
  | 'break_start'
  | 'break_end'
  | 'late_notice'
  | 'manual_request';

export type AttendanceDayStatus = 'zamaninda' | 'gec_geldi' | 'devamsiz' | 'erken_cikti' | 'eksik_kayit';

export type AttendanceEvent = {
  id: string;
  staff_id: string;
  event_type: AttendanceEventType;
  event_time: string;
  source: 'mobile' | 'admin' | 'system' | 'offline_sync';
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  distance_to_hotel_m: number | null;
  location_status: 'verified' | 'outside_hotel_radius' | 'missing' | 'unavailable';
  note: string | null;
  metadata: Record<string, unknown>;
};

export type AttendanceTodayResponse = {
  today: string;
  report: {
    work_date?: string;
    check_in_at?: string | null;
    check_out_at?: string | null;
    total_hours?: number | null;
    late_minutes?: number | null;
    day_status?: AttendanceDayStatus;
  };
  events: AttendanceEvent[];
};

export type AttendanceLocationPayload = {
  latitude?: number | null;
  longitude?: number | null;
  accuracyM?: number | null;
  note?: string | null;
  deviceInfo?: Record<string, unknown>;
  eventTime?: string;
  source?: 'mobile' | 'admin' | 'system' | 'offline_sync';
};

type RpcResult = {
  ok: boolean;
  event_time: string;
  late_minutes?: number;
  location_status?: string;
  distance_to_hotel_m?: number;
};

export async function checkInStaffAttendance(payload: AttendanceLocationPayload): Promise<RpcResult> {
  const { data, error } = await supabase.rpc('staff_attendance_check_in', {
    p_latitude: payload.latitude ?? null,
    p_longitude: payload.longitude ?? null,
    p_accuracy_m: payload.accuracyM ?? null,
    p_device_info: payload.deviceInfo ?? {},
    p_note: payload.note ?? null,
    p_event_time: payload.eventTime ?? new Date().toISOString(),
    p_source: payload.source ?? 'mobile',
  });
  if (error) throw new Error(error.message);
  return (data ?? {}) as RpcResult;
}

export async function checkOutStaffAttendance(payload: AttendanceLocationPayload): Promise<RpcResult> {
  const { data, error } = await supabase.rpc('staff_attendance_check_out', {
    p_latitude: payload.latitude ?? null,
    p_longitude: payload.longitude ?? null,
    p_accuracy_m: payload.accuracyM ?? null,
    p_device_info: payload.deviceInfo ?? {},
    p_note: payload.note ?? null,
    p_event_time: payload.eventTime ?? new Date().toISOString(),
    p_source: payload.source ?? 'mobile',
  });
  if (error) throw new Error(error.message);
  return (data ?? {}) as RpcResult;
}

export async function addStaffAttendanceEvent(eventType: Exclude<AttendanceEventType, 'check_in' | 'check_out'>, note?: string): Promise<RpcResult> {
  const { data, error } = await supabase.rpc('staff_attendance_add_event', {
    p_event_type: eventType,
    p_note: note ?? null,
    p_event_time: new Date().toISOString(),
    p_source: 'mobile',
  });
  if (error) throw new Error(error.message);
  return (data ?? {}) as RpcResult;
}

export async function getMyAttendanceToday(): Promise<AttendanceTodayResponse> {
  const { data, error } = await supabase.rpc('get_my_attendance_today');
  if (error) throw new Error(error.message);
  return (data ?? { today: '', report: {}, events: [] }) as AttendanceTodayResponse;
}
