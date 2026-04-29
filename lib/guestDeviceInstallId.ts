import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@valoria/guest_device_install_id';

function randomInstallId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Paralel ilk çağrılarda iki kez UUID üretilmesini engeller */
let loadOnce: Promise<string> | null = null;

/**
 * Aynı uygulama kurulumu için kararlı cihaz kimliği; çıkış yapıldığında da korunur.
 * Anonim misafir tekrar girişte sunucu aynı `guests` satırını bu kimlikle eşleştirir.
 */
export async function getOrCreateGuestDeviceInstallId(): Promise<string> {
  if (!loadOnce) {
    loadOnce = (async () => {
      const existing = await AsyncStorage.getItem(STORAGE_KEY);
      if (existing && existing.length >= 8) {
        return existing;
      }
      const id = randomInstallId();
      await AsyncStorage.setItem(STORAGE_KEY, id);
      return id;
    })();
  }
  try {
    return await loadOnce;
  } catch (e) {
    loadOnce = null;
    throw e;
  }
}
