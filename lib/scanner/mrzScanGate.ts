import type { ParsedDocument } from './types';
import { mrzCharsetRatio } from './mrzCharset';

export type MrzSaveBlockReason = 'no_mrz' | 'parse_failed' | 'checksum_invalid' | 'low_confidence_ocr';

const MRZ_OCR_OK_MIN = 0.9;

/**
 * Sadece ICAO check digit'leri geçen MRZ kayda yazılır (profesyonel kural).
 * Bulanık / şüpheli OCR: düşük charset oranı + checksum doğrulanamıyorsa engellenir.
 */
export function canSaveMrzDocument(args: {
  rawMrz: string | null;
  parsed: ParsedDocument;
}):
  | { allowed: true }
  | { allowed: false; reason: MrzSaveBlockReason } {
  const { rawMrz, parsed } = args;
  const raw = rawMrz?.trim() ?? '';
  if (!raw) {
    return { allowed: false, reason: 'no_mrz' };
  }

  const hasParseFailed = parsed.warnings?.some(
    (w) => w === 'MRZ parse failed' || w.includes('parse failed')
  );
  if (hasParseFailed) {
    return { allowed: false, reason: 'parse_failed' };
  }

  const ratio = mrzCharsetRatio(raw);
  if (ratio < MRZ_OCR_OK_MIN && parsed.checksumsValid !== true) {
    return { allowed: false, reason: 'low_confidence_ocr' };
  }

  if (parsed.checksumsValid === false) {
    return { allowed: false, reason: 'checksum_invalid' };
  }
  if (parsed.checksumsValid !== true) {
    return { allowed: false, reason: ratio < MRZ_OCR_OK_MIN ? 'low_confidence_ocr' : 'parse_failed' };
  }

  return { allowed: true };
}

export function isMrzPayload(rawMrz: string | null | undefined): boolean {
  return Boolean(rawMrz && String(rawMrz).trim().length > 0);
}
