import type { SupabaseClient } from '@supabase/supabase-js';

function jsonSafe(v: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    return null;
  }
}

/** Gateway çağrısı bittiğinde (başarı / hata) ops.kbs_logs satırı — best-effort. */
export async function recordKbsGatewayResult(
  supabase: SupabaseClient,
  args: {
    hotelId: string;
    transactionId: string;
    guestDocumentId?: string | null;
    status: 'success' | 'failed';
    errorMessage?: string | null;
    requestSummary?: Record<string, unknown> | null;
    responseSummary?: unknown;
  }
): Promise<void> {
  try {
    const { error } = await supabase.schema('ops').from('kbs_logs').insert({
      hotel_id: args.hotelId,
      transaction_id: args.transactionId,
      guest_document_id: args.guestDocumentId ?? null,
      status: args.status,
      error_message: args.errorMessage ?? null,
      request_payload: args.requestSummary ?? null,
      response_payload: args.responseSummary != null ? (jsonSafe(args.responseSummary) as object) : null
    });
    if (error) console.error('[kbs_logs]', error.message);
  } catch (e) {
    console.error('[kbs_logs]', e);
  }
}
