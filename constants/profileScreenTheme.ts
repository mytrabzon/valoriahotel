/**
 * Profil (misafir + personel) “Profilim” bölümü — ortak renk ve ölçüler.
 */
export const profileScreenTheme = {
  /** Ana gradient (marka) */
  gradient: { start: '#667EEA', end: '#F093FB' },
  bg: '#F9FAFB',
  card: '#FFFFFF',
  text: '#111827',
  subtext: '#6B7280',
  /** Kart ikonları (sırayla dönen veya atama için) */
  accent: {
    blue: '#3B82F6',
    green: '#10B981',
    orange: '#F59E0B',
    purple: '#8B5CF6',
    red: '#EF4444',
  },
  /** Üst renk alanı (hero) */
  hero: {
    height: 180,
    bottomRadius: 24,
  },
  /** “Floating” avatar */
  avatar: {
    size: 88,
    border: 4,
  },
  iconBg: 'rgba(102, 126, 234, 0.1)',
  /** İstatistik kartı gölge (React Native) */
  statShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
  },
  /** Avatar hafif gölge (bonus) */
  avatarShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  /**
   * Kapak foto – çerçeve (Profilim + ziyaret). Tam genişlik; üst sıfıra; yuvarlama sadece altta.
   */
  coverFrame: {
    /** Yan boşluk: 0 = kapak ekran genişliğine kadar, gri şerit kalkar */
    inset: 0,
    /** Alt köşe; üst 0 (üstte komşu / ekran hizası) */
    radiusBottom: 20,
    borderW: 1.5,
    border: 'rgba(15, 23, 42, 0.12)',
    marginTop: 0,
  },
  coverFrameShadow: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 30,
    elevation: 10,
  },
} as const;
