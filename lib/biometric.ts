/**
 * PARMAK İZİ / YÜZ TANIMA (Biyometrik)
 * Sözleşme onayı veya hızlı giriş için
 */
import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricType = 'fingerprint' | 'facial' | 'iris' | 'none';

export interface BiometricResult {
  success: boolean;
  error?: string;
  type?: BiometricType;
}

/**
 * Cihazda biyometrik var mı?
 */
export async function hasBiometric(): Promise<boolean> {
  const has = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return has && enrolled;
}

/**
 * Biyometrik türünü al (parmak / yüz)
 */
export async function getBiometricType(): Promise<BiometricType> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION))
    return 'facial';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT))
    return 'fingerprint';
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'iris';
  return 'none';
}

/**
 * Biyometrik doğrulama iste (parmak / Face ID)
 */
export async function authenticate(
  promptMessage: string = 'Kimliğinizi doğrulayın'
): Promise<BiometricResult> {
  try {
    const ok = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'İptal',
    });
    return { success: ok.success, type: await getBiometricType() };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Biyometrik hata',
    };
  }
}
