import { supabase } from '@/lib/supabase';
import { uriToArrayBuffer } from '@/lib/uploadMedia';

function contentTypeForName(name: string): string {
  const l = name.toLowerCase();
  if (l.endsWith('.png')) return 'image/png';
  if (l.endsWith('.webp')) return 'image/webp';
  if (l.endsWith('.heic')) return 'image/heic';
  return 'image/jpeg';
}

export async function uploadDiningVenueImage(params: {
  organizationId: string;
  venueId: string;
  localUri: string;
  fileName: string;
}): Promise<string> {
  const { organizationId, venueId, localUri, fileName } = params;
  const path = `org/${organizationId}/dining-venues/${venueId}/${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const buf = await uriToArrayBuffer(localUri, { mediaKind: 'image' });
  const { error } = await supabase.storage
    .from('dining-venues')
    .upload(path, buf, { contentType: contentTypeForName(fileName), upsert: true });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('dining-venues').getPublicUrl(path);
  return data.publicUrl;
}
