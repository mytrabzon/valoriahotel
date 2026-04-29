import type { User } from '@supabase/supabase-js';

/** Misafir girişi; bazı ortamlarda `is_anonymous` eksik kalabiliyor — kimlik/provider ile yedeklenir. */
export function isAnonymousAuthUser(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.is_anonymous === true) return true;
  const providers = user.app_metadata?.providers;
  if (Array.isArray(providers) && providers.includes('anonymous')) return true;
  if (user.app_metadata?.provider === 'anonymous') return true;
  return user.identities?.some((i) => i.provider === 'anonymous') ?? false;
}
