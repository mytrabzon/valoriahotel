import { Image } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * `ops.guest_documents.ocr_engine` değeri.
 * Önerilen kurumsal yığın (harici, lisanslı): Regula / Microblink; cihaz üstü
 * hız ve offline için VisionCamera+MLKit mümkün ama EAS iOS bu projede
 * expo-text-extractor ile sınırlandı.
 */
export const MRZ_OCR_ENGINE_EXPO = 'expo-text-extractor' as const;

/** MRZ OCR öncesi çok büyük kareleri küçültür (extractor için daha tutarlı süre ve bellek). */
async function normalizeImageForOcr(uri: string): Promise<string> {
  const maxEdge = 2000;
  try {
    const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      Image.getSize(uri, (w, h) => resolve({ width: w, height: h }), reject);
    });
    if (width <= maxEdge && height <= maxEdge) return uri;
    const actions =
      width >= height ? [{ resize: { width: maxEdge } }] : [{ resize: { height: maxEdge } }];
    const out = await manipulateAsync(uri, actions, { compress: 0.92, format: SaveFormat.JPEG });
    return out.uri;
  } catch {
    return uri;
  }
}

/**
 * Cihaz üstü OCR (expo-text-extractor). VisionCamera/ML Kit kaldırıldı (EAS iOS derlemesi).
 */
export async function ocrLinesFromImage(uri: string): Promise<{ lines: string[]; engine: 'expo' }> {
  const prepared = await normalizeImageForOcr(uri);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('expo-text-extractor') as {
    extractTextFromImage: (u: string) => Promise<string[]>;
    isSupported?: boolean;
  };
  if (mod?.isSupported === false) throw new Error('OCR_NOT_SUPPORTED');
  const lines = await mod.extractTextFromImage(prepared);
  return { lines, engine: 'expo' };
}
