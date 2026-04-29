/**
 * Karbon modülü: varsayılan metinler ve dış bağlantılar (bilgilendirme / telafi).
 * Katsayı kaynakları otelde yıllık güncellenmeli; buradaki metinler şablon niteliğindedir.
 */

export const DEFAULT_METHODOLOGY_SUMMARY = `Bu hesaplama bilgilendirme ve iç süreç iyileştirmesi içindir; bağımsız üçüncü taraf doğrulaması veya resmî GHG Protocol uyumluluk beyanı yerine geçmez.

Kapsam (sınırlandırılmış): Tesis düzeyinde aylık elektrik, su, doğalgaz ve atık verileri, ilgili ay içindeki toplam konaklama gecesine bölünerek misafir payına indirgenir. Ulaşım, gıda, satın alınan mal ve hizmetler (Scope 3) bu tabloda dahil edilmemiştir. Yönetim karbon raporunda, onaylı harcama ve maaş tutarları üzerinden ayrı bir “harcama bazlı tahmin” bloğu isteğe bağlı gösterilebilir; o blok ana tesis toplamına eklenmez.

Dağıtım kuralı: Ayın toplam tüketimi × (misafirin konaklama gecesi ÷ ay içi toplam konaklama gecesi). Toplam geceler, sistemdeki konaklama kayıtlarından türetilir; gerekirse yönetici tarafından manuel düzeltilebilir.

Emisyon katsayıları (kg CO₂ birim başına) yönetici tarafından girilir; kaynak alanlarında TBMP, EPA, ulusal şebeke faktörü veya kurum içi kabul görmüş değer referansı belirtilmelidir.`;

export const CARBON_OFFSET_INFO_URL = 'https://www.goldstandard.org/';
export const CARBON_TURKEY_CLIMATE_URL = 'https://www.csb.gov.tr/';

/** Spend-based Scope 3 gösterimi: sunucu RPC ile aynı varsayılan çarpan (migration 158). */
export const SCOPE3_SPEND_KG_CO2E_PER_TRY_DEFAULT = 0.00035;

/** Ekran / PDF uyarısı — ana tesis CO₂ satırlarından ayrı tutulur. */
export const SCOPE3_SPEND_DISCLAIMER = `Bu blok yalnızca bilgilendirme amaçlıdır: onaylı personel harcamaları (tarihe göre) ile onaylı maaş ödemeleri (dönem ayına göre) toplam TRY tutarı, tek bir kabullü çarpan (${SCOPE3_SPEND_KG_CO2E_PER_TRY_DEFAULT} kg CO₂e/TRY) ile çarpılarak tahmini kg CO₂e üretir. GHG Protocol veya kurumsal sürdürülebilirlik raporlarında “birincil aktivite verisi” yerine geçmez; emisyon faktörü işletme politikasına göre güncellenmelidir. Tesis elektrik/su/gaz/atık tabanlı karbon özeti ile toplanmamalıdır.`;
