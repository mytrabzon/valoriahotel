/**
 * React Native / Expo Go'da global `crypto` yok; expo-file-system ve bazı modüller
 * crypto.randomUUID() kullandığı için uygulama girişinde polyfill uygulanır.
 */
declare global {
  // eslint-disable-next-line no-var
  var crypto: { randomUUID?: () => string };
}

if (typeof globalThis.crypto === 'undefined' || typeof globalThis.crypto.randomUUID !== 'function') {
  const getRandomValues = (buffer: Uint8Array): Uint8Array => {
    for (let i = 0; i < buffer.length; i++) buffer[i] = Math.floor(Math.random() * 256);
    return buffer;
  };
  const randomUUID = (): string => {
    const bytes = new Uint8Array(16);
    getRandomValues(bytes);
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b!.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
  globalThis.crypto = {
    ...(typeof globalThis.crypto === 'object' && globalThis.crypto ? globalThis.crypto : {}),
    randomUUID,
  };
}

export {};
