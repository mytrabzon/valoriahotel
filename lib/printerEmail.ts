import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';

type PrinterSettings = {
  enabled?: boolean;
  email?: string;
};

const DEFAULT_PRINTER_EMAIL = '536w8897jy@hpeprint.com';

async function loadPrinterEmail(): Promise<string> {
  let { data, error } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', 'printer')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error?.code === '42P01' || error?.code === 'PGRST205' || error?.status === 404) {
    const fallback = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'printer')
      .order('updated_at', { ascending: false })
      .limit(1);
    data = fallback.data as typeof data;
    error = fallback.error as typeof error;
  }

  if (error) return DEFAULT_PRINTER_EMAIL;
  const value = (data?.[0]?.value ?? {}) as PrinterSettings;
  return (value.email ?? DEFAULT_PRINTER_EMAIL).trim() || DEFAULT_PRINTER_EMAIL;
}

export async function sendPdfToPrinterEmail(opts: {
  pdfUri: string;
  subject: string;
  fileName: string;
}): Promise<void> {
  const to = await loadPrinterEmail();
  const contentBase64 = await FileSystem.readAsStringAsync(opts.pdfUri, { encoding: FileSystem.EncodingType.Base64 });

  const { data, error } = await supabase.functions.invoke('send-printer-document', {
    body: {
      to,
      subject: opts.subject,
      fileName: opts.fileName,
      contentBase64,
    },
  });

  if (error) throw new Error(error.message || 'Yazıcı e-postası gönderilemedi');
  if (data?.ok !== true) {
    throw new Error(data?.error?.message || 'Yazıcı e-postası gönderilemedi');
  }
}
