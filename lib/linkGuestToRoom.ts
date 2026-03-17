import { supabase } from '@/lib/supabase';
import { log } from '@/lib/logger';

/**
 * Giriş yapan müşteriyi seçilen odaya bağlar.
 * Var olan guest kaydı varsa günceller, yoksa yeni kayıt oluşturur.
 */
export async function linkGuestToRoom(
  email: string,
  roomId: string,
  fullName?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const name = (fullName && fullName.trim()) || email.split('@')[0] || 'Misafir';
  try {
    const { data: existing } = await supabase
      .from('guests')
      .select('id')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const now = new Date().toISOString();
    if (existing?.id) {
      const { error } = await supabase
        .from('guests')
        .update({
          room_id: roomId,
          status: 'checked_in',
          check_in_at: now,
          updated_at: now,
        })
        .eq('id', existing.id);
      if (error) {
        log.error('linkGuestToRoom', 'update', error.message);
        return { ok: false, error: error.message };
      }
      return { ok: true };
    }

    const { error } = await supabase.from('guests').insert({
      full_name: name,
      email,
      room_id: roomId,
      contract_lang: 'tr',
      status: 'checked_in',
      check_in_at: now,
    });
    if (error) {
      log.error('linkGuestToRoom', 'insert', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    const msg = (e as Error)?.message ?? 'Bilinmeyen hata';
    log.error('linkGuestToRoom', 'exception', e, msg);
    return { ok: false, error: msg };
  }
}
