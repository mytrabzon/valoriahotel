/**
 * Varsayılan Maliye mührü — basit vektör (PDF uyumluluğu için textPath yok).
 * Matbaadaki mühürle birebir eşleşme için ayarlardan PNG yükleyin (ministrySealDataUrl).
 */
export function ministrySealSvgWithProvince(provinceCode: string): string {
  const code = (provinceCode || '—').replace(/</g, '').replace(/&/g, '');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <circle cx="100" cy="100" r="96" fill="none" stroke="#000" stroke-width="2.4"/>
  <circle cx="100" cy="100" r="82" fill="none" stroke="#000" stroke-width="1"/>
  <circle cx="100" cy="100" r="68" fill="none" stroke="#000" stroke-width="0.8"/>
  <text x="100" y="44" text-anchor="middle" font-family="Times New Roman, Times, serif" font-size="10" font-weight="700" fill="#000">T.C.</text>
  <text x="100" y="60" text-anchor="middle" font-family="Times New Roman, Times, serif" font-size="9.2" font-weight="700" fill="#000">HAZİNE VE MALİYE</text>
  <text x="100" y="74" text-anchor="middle" font-family="Times New Roman, Times, serif" font-size="9.2" font-weight="700" fill="#000">BAKANLIĞI</text>
  <text x="100" y="118" text-anchor="middle" font-family="Times New Roman, Times, serif" font-size="34" font-weight="700" fill="#000">T.C.</text>
  <text x="100" y="182" text-anchor="middle" font-family="Times New Roman, Times, serif" font-size="10" fill="#000">İL KODU: ${code}</text>
</svg>`;
}
