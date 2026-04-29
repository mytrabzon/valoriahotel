import * as FileSystem from 'expo-file-system';

const MAPBOX_TOKEN =
  typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN
    ? String(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN).replace(/"/g, '')
    : '';

/**
 * Harita önizlemesi URL’leri: önce Mapbox (varsa), yok / hata — OSM staticmap.
 */
export function staticMapImageUrlsForLocation(lat: number, lng: number, size: number = 512): string[] {
  const la = Math.min(85, Math.max(-85, lat));
  const ln = Math.min(180, Math.max(-180, lng));
  const w = size;
  const h = size;
  const out: string[] = [];
  if (MAPBOX_TOKEN) {
    const t = encodeURIComponent(MAPBOX_TOKEN);
    // pin (lng,lat) + kamera: merkez ve zoom
    out.push(
      `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+b8860b(${ln},${la})/${ln},${la},16,0,0/${w}x${h}@2x?access_token=${t}`
    );
  }
  // https://staticmap.openstreetmap.de/ — basit, token gerektirmez
  out.push(
    `https://staticmap.openstreetmap.de/staticmap.php?center=${la},${ln}&zoom=16&size=${w}x${h}&maptype=mapnik`
  );
  return out;
}

/**
 * İndirilen PNG/JPEG geçici dosya URI; yükleme için kullanılır, kapak/avatar.
 */
export async function downloadDiningMapSnapshotToCache(lat: number, lng: number): Promise<string | null> {
  const base = FileSystem.cacheDirectory;
  if (!base) return null;
  const dest = `${base}dining_map_loc_${Date.now()}.png`;
  const urls = staticMapImageUrlsForLocation(lat, lng);
  for (const u of urls) {
    try {
      const { uri, status } = await FileSystem.downloadAsync(u, dest);
      if (status >= 200 && status < 400) return uri;
    } catch {
      /* dene */
    }
  }
  return null;
}

export async function deleteDiningMapSnapshotFile(uri: string | null): Promise<void> {
  if (!uri || !uri.includes('dining_map_loc_')) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    /* no-op */
  }
}
