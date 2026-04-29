import { supabase } from '@/lib/supabase';

const FEED_MEDIA_BUCKET = 'feed-media';

/**
 * Public URL'lerden `feed-media` bucket içi `storage.objects.name` yollarını çıkarır.
 */
export function feedMediaStoragePathsFromPublicUrls(
  urls: (string | null | undefined)[]
): string[] {
  const marker = `/object/public/${FEED_MEDIA_BUCKET}/`;
  const set = new Set<string>();
  for (const raw of urls) {
    if (!raw || typeof raw !== 'string') continue;
    const u = raw.trim();
    const idx = u.indexOf(marker);
    if (idx === -1) continue;
    let path = u.slice(idx + marker.length);
    const q = path.indexOf('?');
    if (q !== -1) path = path.slice(0, q);
    try {
      path = decodeURIComponent(path);
    } catch {
      /* ignore */
    }
    if (path) set.add(path);
  }
  return Array.from(set);
}

/** `feed_posts` satırı silindikten sonra çağırın; medya/thumbnail `feed-media` dışındaysa no-op. */
export async function removeFeedMediaObjectsForPostUrls(
  urls: (string | null | undefined)[]
): Promise<void> {
  const paths = feedMediaStoragePathsFromPublicUrls(urls);
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(FEED_MEDIA_BUCKET).remove(paths);
  if (error) {
    console.warn('[feed-media] remove after post delete:', error.message);
  }
}
