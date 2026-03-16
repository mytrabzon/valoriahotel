import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { log } from '@/lib/logger';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

log.info('Supabase init', {
  hasUrl: !!supabaseUrl,
  urlPrefix: supabaseUrl ? supabaseUrl.slice(0, 30) + '...' : 'MISSING',
  hasAnonKey: !!supabaseAnonKey,
});
if (!supabaseUrl || !supabaseAnonKey) {
  log.error('Supabase env eksik', { supabaseUrl: !!supabaseUrl, supabaseAnonKey: !!supabaseAnonKey });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type GuestStatus = 'pending' | 'checked_in' | 'checked_out' | 'cancelled';
export type RoomStatus = 'available' | 'occupied' | 'cleaning' | 'maintenance' | 'out_of_order';
export type StaffRole = 'admin' | 'reception_chief' | 'receptionist' | 'housekeeping' | 'technical' | 'security';
