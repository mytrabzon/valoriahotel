/** OCR satırlarından MRZ metni çıkarır (TD1/TD2/TD3). */
export function extractMrzFromLines(lines: string[]): string | null {
  const cleaned = lines
    .map((l) => String(l || '').trim().toUpperCase().replace(/\s+/g, ''))
    .filter(Boolean);
  const candidates = cleaned.filter((l) => l.includes('<') && l.length >= 25);
  for (let i = 0; i < candidates.length - 1; i++) {
    const a = candidates[i];
    const b = candidates[i + 1];
    if (a.length === 44 && b.length === 44) return `${a}\n${b}`;
  }
  for (let i = 0; i < candidates.length - 2; i++) {
    const a = candidates[i];
    const b = candidates[i + 1];
    const c = candidates[i + 2];
    if (a.length === 30 && b.length === 30 && c.length === 30) return `${a}\n${b}\n${c}`;
  }
  const mrzLike = candidates.sort((x, y) => y.length - x.length).slice(0, 3);
  if (mrzLike.length >= 2 && mrzLike[0].length >= 40) return `${mrzLike[0]}\n${mrzLike[1]}`;
  return null;
}
