import { supabase } from '@/lib/supabase';

/** Guess MIME when picker/storage omits it (needed for list thumbnails). */
export function inferDocumentMimeFromFileName(fileName: string): string | null {
  const n = (fileName || '').toLowerCase();
  if (/\.pdf$/i.test(n)) return 'application/pdf';
  if (/\.jpe?g$/i.test(n)) return 'image/jpeg';
  if (/\.png$/i.test(n)) return 'image/png';
  if (/\.webp$/i.test(n)) return 'image/webp';
  if (/\.gif$/i.test(n)) return 'image/gif';
  if (/\.heic$/i.test(n)) return 'image/heic';
  if (/\.heif$/i.test(n)) return 'image/heif';
  return null;
}

/** `file://` veya cache URI sonunda uzantı varken MIME çıkarır (Android’de mime boş gelebilir). */
export function inferDocumentMimeFromUri(uri: string | null | undefined): string | null {
  if (!uri) return null;
  const pathOnly = uri.split('?')[0].split('#')[0];
  return inferDocumentMimeFromFileName(pathOnly);
}

/** Depolama nesne adı için kısa uzantı (yol `.../v1-ts.jpg` ile tutarlı olsun). */
export function defaultExtensionForMime(mime: string | null | undefined): string | null {
  const m = (mime || '').toLowerCase();
  if (m === 'image/jpeg') return 'jpg';
  if (m === 'image/png') return 'png';
  if (m === 'image/webp') return 'webp';
  if (m === 'image/gif') return 'gif';
  if (m === 'image/heic' || m === 'image/heif') return 'heic';
  if (m === 'application/pdf') return 'pdf';
  return null;
}

/**
 * Görsel mi? `mime` yanlış/ boş / octet-stream olsa bile dosya adı veya **storage file_path**
 * uçlarından (.jpg vb.) anlaşılabilir — yüklemede ad uzantısız kalınca yol üzerinden tanınır.
 */
export function isDocumentImageMime(
  mime: string | null | undefined,
  fileName: string,
  filePath?: string | null
): boolean {
  const mt = mime ? String(mime).toLowerCase().trim() : '';
  if (mt.startsWith('image/')) return true;

  const fromName = inferDocumentMimeFromFileName(fileName);
  const fromPath = inferDocumentMimeFromFileName(filePath || '');
  if (fromName && fromName.startsWith('image/')) return true;
  if (fromPath && fromPath.startsWith('image/')) return true;

  if (mt === 'application/octet-stream' || mt === '') {
    return !!(fromName?.startsWith('image/') || fromPath?.startsWith('image/'));
  }

  return false;
}

/**
 * Belgeler bucket’ı migration’da **public**; önizleme için imzalı URL gerekmez.
 * `createSignedUrl` storage.objects SELECT (RLS) ister; org/staff eşlemesi zayıfsa URL boş kalırdı.
 * Public URL doğrudan HTTP ile okunur (Image / WebView).
 */
export function getDocumentsBucketPublicUrl(filePath: string | null | undefined): string | null {
  const path = (filePath || '').trim();
  if (!path) return null;
  const { data } = supabase.storage.from('documents').getPublicUrl(path);
  return data?.publicUrl ?? null;
}

/** İmzalı URL (bucket private yapılırsa veya özel ihtiyaç). */
export async function createDocumentsBucketSignedUrl(
  filePath: string,
  expiresInSec = 3600
): Promise<{ url: string | null; error: Error | null }> {
  const path = (filePath || '').trim();
  if (!path) return { url: null, error: new Error('empty path') };
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, expiresInSec);
  if (error) return { url: null, error: new Error(error.message) };
  return { url: data?.signedUrl ?? null, error: null };
}
