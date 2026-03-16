/**
 * NFC / Deep Link: valoria-hotel://guest?token=XXX veya valoria-hotel://checkin/roomId
 * NFC etiketine bu URL yazılırsa, müşteri telefonu değdirdiğinde uygulama açılır.
 */
import * as Linking from 'expo-linking';

const SCHEME = 'valoria-hotel';

export interface ParsedCheckinLink {
  type: 'token' | 'room';
  token?: string;
  roomId?: string;
}

/**
 * Gelen URL'den token veya roomId çıkar
 * Örnek: valoria-hotel://guest?token=abc123 -> { type: 'token', token: 'abc123' }
 * Örnek: valoria-hotel://checkin/ROOM_UUID -> { type: 'room', roomId: 'ROOM_UUID' }
 */
export function parseCheckinUrl(url: string): ParsedCheckinLink | null {
  try {
    const parsed = Linking.parse(url);
    const path = (parsed.path ?? '') as string;
    const query = (parsed.queryParams ?? {}) as Record<string, string>;

    if (query.token) {
      return { type: 'token', token: query.token };
    }
    // valoria-hotel://checkin/roomId
    if (path.startsWith('checkin/')) {
      const roomId = path.replace('checkin/', '').split('/')[0];
      if (roomId) return { type: 'room', roomId };
    }
    // valoria-hotel://guest?token=xxx
    if (path === 'guest' && query.token) {
      return { type: 'token', token: query.token };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * NFC etiketi veya QR için kullanılacak URL (oda token'ı ile)
 */
export function getCheckinUrl(token: string): string {
  return `${SCHEME}://guest?token=${encodeURIComponent(token)}`;
}
