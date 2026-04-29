import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { isAnonymousAuthUser } from '@/lib/isAnonymousAuthUser';

/**
 * Giriş e-postası değişimi: updateUser e-posta gönderir, verifyOtp ile onaylanır.
 * @see https://supabase.com/docs/reference/javascript/auth-verifyotp
 */
export async function requestEmailChangeCode(newEmail: string): Promise<{ error: Error | null }> {
  const e = newEmail.trim().toLowerCase();
  if (!e) return { error: new Error('email') };
  const { error } = await supabase.auth.updateUser({ email: e });
  return { error: error as Error | null };
}

export async function confirmEmailChangeWithOtp(email: string, token: string): Promise<{ error: Error | null }> {
  const e = email.trim().toLowerCase();
  const digits = token.replace(/\D/g, '');
  const tryTypes = ['email_change', 'email'] as const;
  let lastErr: Error | null = null;
  for (const type of tryTypes) {
    const { error } = await supabase.auth.verifyOtp({
      email: e,
      token: digits,
      type,
    });
    if (!error) return { error: null };
    lastErr = error as Error;
  }
  return { error: lastErr };
}

export async function resendEmailChangeCode(email: string): Promise<{ error: Error | null }> {
  const e = email.trim().toLowerCase();
  const { error } = await supabase.auth.resend({
    type: 'email_change',
    email: e,
  });
  return { error: error as Error | null };
}

/**
 * Şifre belirleme (anonim → şahsi ilk adımında updateUser ile birlikte).
 */
export async function setAccountPassword(password: string): Promise<{ error: Error | null }> {
  if (password.length < 6) return { error: new Error('short') };
  const { error } = await supabase.auth.updateUser({ password });
  return { error: error as Error | null };
}

/**
 * Oturumdaki kullanıcıya göre guests.email ve is_guest_app_account senkronu.
 */
export async function syncGuestRowWithAuthUser(user: User | null | undefined): Promise<void> {
  if (!user?.id) return;
  const email = (user.email ?? (user as { new_email?: string }).new_email ?? '').trim().toLowerCase();
  if (!email) return;
  /** Yalnızca gerçek anonim misafir uygulama oturumu; e-posta ile girişi @valoria.guest ile karıştırma. */
  const guestApp = isAnonymousAuthUser(user);
  await supabase
    .from('guests')
    .update({
      email,
      is_guest_app_account: guestApp,
    })
    .eq('auth_user_id', user.id);
}
