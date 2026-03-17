/**
 * Admin paneli kurumsal tema: lacivert, slate, altın vurgu.
 * Butonlar canlı (press feedback), renkler kurumsal yapıda.
 */
export const adminTheme = {
  colors: {
    // Ana kurumsal
    primary: '#0f172a',       // slate-900 — ana başlık / header
    primaryLight: '#1e293b',  // slate-800
    primaryMuted: '#334155',  // slate-700
    // Vurgu (altın / amber — otel hissi)
    accent: '#b45309',        // amber-700
    accentLight: '#d97706',  // amber-600
    accentBright: '#f59e0b',  // amber-500 — buton hover/canlı
    // Yüzeyler
    surface: '#ffffff',
    surfaceSecondary: '#f8fafc',  // slate-50
    surfaceTertiary: '#f1f5f9',   // slate-100
    // Kenarlar
    border: '#e2e8f0',   // slate-200
    borderLight: '#f1f5f9',
    // Metin
    text: '#0f172a',
    textSecondary: '#475569',  // slate-600
    textMuted: '#94a3b8',      // slate-400
    // Durum
    success: '#047857',   // emerald-700
    successLight: '#d1fae5',
    warning: '#b45309',
    warningLight: '#fef3c7',
    error: '#b91c1c',    // red-700
    errorLight: '#fee2e2',
    info: '#0369a1',     // sky-700
    infoLight: '#e0f2fe',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
  // Buton stilleri — canlı görünüm
  button: {
    primaryBg: '#0f172a',
    primaryText: '#ffffff',
    accentBg: '#b45309',
    accentText: '#ffffff',
    outlineBorder: '#334155',
    outlineText: '#0f172a',
    ghostText: '#475569',
  },
  shadow: {
    sm: {
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 2,
    },
    md: {
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 6,
    },
  },
} as const;
