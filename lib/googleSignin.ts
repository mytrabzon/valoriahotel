/**
 * Google Sign-In API — sadece configure/signIn/getTokens/hasPlayServices.
 * Ana paket index'i GoogleSigninButton üzerinden statics.js hatası verdiği için
 * doğrudan signIn modülü yüklenir (buton kullanılmıyor).
 * RNGoogleSignin native modülü Expo Go / bazı dev build'lerde yok; bu durumda
 * null döner, uygulama Google ile giriş butonunu gizleyebilir veya kullanıcıyı uyarabilir.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
let GoogleSignin: typeof import('@react-native-google-signin/google-signin').GoogleSignin | null = null;
let _loadError: unknown = null;
try {
  const mod = require('../node_modules/@react-native-google-signin/google-signin/lib/module/signIn/GoogleSignin.js');
  GoogleSignin = mod?.GoogleSignin ?? null;
} catch (e) {
  _loadError = e;
  GoogleSignin = null;
}
export function getGoogleSigninLoadError(): unknown {
  return _loadError;
}
export { GoogleSignin };
export const isGoogleSigninAvailable = (): boolean => GoogleSignin != null;
