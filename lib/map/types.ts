/**
 * Harita bileşenleri için ortak tipler.
 */

export type MapUserMarker = {
  id: string;
  lat: number;
  lng: number;
  displayName?: string | null;
  avatarUrl?: string | null;
  isMe?: boolean;
};

export type MapPostMarker = {
  id: string;
  lat: number;
  lng: number;
  displayName?: string | null;
  avatarUrl?: string | null;
};

/** Yemek & Mekanlar — kapak görseli yuvarlak marker (harita) */
export type MapDiningMarker = {
  id: string;
  lat: number;
  lng: number;
  displayName?: string | null;
  avatarUrl?: string | null;
};

/** Transfer & Tur operatörü — logo yuvarlak marker (Yemek & Mekanlar ile aynı şekil) */
export type MapTransferTourMarker = {
  id: string;
  lat: number;
  lng: number;
  displayName?: string | null;
  avatarUrl?: string | null;
};
