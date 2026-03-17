/**
 * HMB (Hazine ve Maliye Bakanlığı) raporu için işletme bilgileri.
 * VUK Md. 240 Günlük Müşteri Listesi için zorunlu alanlar.
 * İleride admin ayarlarından okunabilir.
 */
export const HMB_HOTEL_INFO = {
  title: 'VALORIA HOTEL',
  address: 'Atatürk Cad. No:123, Muratpaşa/ANTALYA',
  taxOffice: 'Antalya Kurumlar Vergi Dairesi',
  taxNumber: '123 456 7890',
  tradeRegister: '12345',
  phone: '0242 123 45 67',
  email: 'info@valoriahotel.com',
  authorizedTitle: 'Otel Müdürü',
} as const;

export const VAT_RATE = 0.1; // %10 KDV
export const ACCOMMODATION_TAX_RATE = 0.02; // %2 Konaklama vergisi (1 Ocak 2023 itibarıyla)
