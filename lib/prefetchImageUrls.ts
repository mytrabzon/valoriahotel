import { Image } from 'expo-image';

/** Disk önbelleğini ısıtır; feed’e dönüşte avatar/medya “geç geliyor” hissini azaltır. */
export function prefetchImageUrls(urls: (string | null | undefined)[], max = 48): void {
  const uniq = [...new Set(urls.filter((u): u is string => typeof u === 'string' && u.length > 4))].slice(0, max);
  if (uniq.length === 0) return;
  void Promise.all(uniq.map((u) => Image.prefetch(u).catch(() => {})));
}
