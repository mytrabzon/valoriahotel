export const FIXED_ASSET_CATEGORIES = [
  'Mobilya',
  'Elektronik',
  'Mutfak Ekipmanı',
  'Restoran Ekipmanı',
  'Tekstil',
  'Temizlik Ekipmanı',
  'Teknik Ekipman',
  'Ofis Ekipmanı',
  'Güvenlik Ekipmanı',
  'Dekorasyon',
] as const;

export const FIXED_ASSET_LOCATIONS = [
  'Oda 101',
  'Oda 102',
  'Lobi',
  'Resepsiyon',
  'Mutfak',
  'Restoran',
  'Depo',
  'Teknik Oda',
  'Çamaşırhane',
  'Bahçe',
  'Personel Alanı',
] as const;

export const FIXED_ASSET_STATUSES = [
  { value: 'yerinde', label: 'Yerinde' },
  { value: 'eksik', label: 'Eksik' },
  { value: 'arizali', label: 'Arızalı' },
  { value: 'bakimda', label: 'Bakımda' },
  { value: 'tasindi', label: 'Taşındı' },
] as const;

export function fixedAssetStatusLabel(status: string) {
  return FIXED_ASSET_STATUSES.find((s) => s.value === status)?.label ?? status;
}
