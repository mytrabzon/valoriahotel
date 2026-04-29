/**
 * MRZ yalnızca [0-9A-Z<] (ICAO) kullanır. OCR gürültüsü için oran 0..1.
 */
export function mrzCharsetRatio(mrz: string | null | undefined): number {
  if (!mrz) return 0;
  const t = String(mrz).replace(/\r\n/g, '\n').replace(/\n/g, '');
  if (!t.length) return 0;
  let ok = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    if (c >= 48 && c <= 57) ok += 1;
    else if (c >= 65 && c <= 90) ok += 1;
    else if (c === 60) ok += 1; // '<'
  }
  return ok / t.length;
}
