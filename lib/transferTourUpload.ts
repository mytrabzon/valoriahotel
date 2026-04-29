import { supabase } from '@/lib/supabase';
import { uriToArrayBuffer } from '@/lib/uploadMedia';

function contentTypeForName(name: string): string {
  const l = name.toLowerCase();
  if (l.endsWith('.png')) return 'image/png';
  if (l.endsWith('.webp')) return 'image/webp';
  if (l.endsWith('.heic')) return 'image/heic';
  return 'image/jpeg';
}

export async function uploadTransferTourImage(params: {
  organizationId: string;
  serviceId: string;
  localUri: string;
  fileName: string;
}): Promise<string> {
  const { organizationId, serviceId, localUri, fileName } = params;
  const path = `org/${organizationId}/transfer-tour/${serviceId}/${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const buf = await uriToArrayBuffer(localUri, { mediaKind: 'image' });
  const { error } = await supabase.storage
    .from('transfer-tour')
    .upload(path, buf, { contentType: contentTypeForName(fileName), upsert: true });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('transfer-tour').getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadTransferTourOperatorLogo(params: {
  organizationId: string;
  serviceId: string;
  localUri: string;
  fileName?: string;
}): Promise<string> {
  return uploadTransferTourImage({
    ...params,
    fileName: params.fileName ?? 'operator_logo.jpg',
  });
}
