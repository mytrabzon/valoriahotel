import { supabase } from '@/lib/supabase';

export type MaliyeSection = {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
};

export async function listMaliyeSections() {
  return await supabase
    .from('maliye_document_sections')
    .select('id, name, display_order, is_active')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
}

export async function createMaliyeToken(pin: string, durationText = '24 hours') {
  return await supabase.rpc('create_maliye_access_token', {
    pin_input: pin,
    expires_in_text: durationText,
  });
}

export async function createOrRotateFixedMaliyeToken(pin: string, durationText = '5 years') {
  return await supabase.rpc('create_or_rotate_default_maliye_token', {
    pin_input: pin,
    expires_in_text: durationText,
  });
}

export async function listMaliyeTokens() {
  return await supabase
    .from('maliye_access_tokens')
    .select('id, token, expires_at, is_active, created_at, last_used_at')
    .order('created_at', { ascending: false })
    .limit(20);
}

export async function revokeMaliyeToken(id: string) {
  return await supabase.from('maliye_access_tokens').update({ is_active: false }).eq('id', id);
}

export async function updateMaliyeTokenPin(id: string, newPin: string) {
  return await supabase.rpc('update_maliye_token_pin', {
    target_token_id: id,
    new_pin: newPin,
  });
}

export async function listMaliyeLogs(limit = 200) {
  return await supabase
    .from('maliye_audit_logs')
    .select('id, event_type, success, ip_address, user_agent, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
}
