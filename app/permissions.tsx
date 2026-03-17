import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { theme } from '@/constants/theme';

type PermStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

/**
 * Uygulamanın kullandığı cihaz izinleri (misafir ve personel tarafından görüntülenebilir).
 * Tıklanınca: izin yoksa istenir, verilmişse ayarlar açılır (iptal için).
 */
const DEVICE_PERMISSIONS = [
  {
    key: 'camera',
    icon: 'camera-outline' as const,
    title: 'Kamera',
    reason: 'QR kod okutma (sözleşme onayı, check-in), stok barkodu tarama.',
  },
  {
    key: 'photo_library',
    icon: 'images-outline' as const,
    title: 'Fotoğraf / Galeri',
    reason: 'Profil fotoğrafı ve belge yükleme.',
  },
  {
    key: 'location',
    icon: 'location-outline' as const,
    title: 'Konum',
    reason: 'Otele yaklaştığınızda check-in bildirimi; otel bölgesine girdiğinizde hoş geldiniz bildirimi.',
  },
  {
    key: 'notifications',
    icon: 'notifications-outline' as const,
    title: 'Bildirimler',
    reason: 'Anlık bildirimler (mesaj, rezervasyon, acil duyuru).',
  },
  {
    key: 'biometric',
    icon: 'finger-print-outline' as const,
    title: 'Biyometri (Face ID / Parmak izi)',
    reason: 'Sözleşme onayında kimlik doğrulama.',
  },
  {
    key: 'microphone',
    icon: 'mic-outline' as const,
    title: 'Mikrofon',
    reason: 'Sesli mesaj veya arama özellikleri için (gelecekte kullanılabilir).',
  },
];

async function getStatus(key: string): Promise<PermStatus> {
  try {
    switch (key) {
      case 'camera': {
        try {
          const Camera = await import('expo-camera');
          const { status } = await Camera.getCameraPermissionsAsync();
          return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
        } catch {
          // Modül veya izin API’si kullanılamıyorsa (örn. web) “istenmedi” göster; tıklanınca yine dene
          return 'undetermined';
        }
      }
      case 'photo_library': {
        const ImagePicker = await import('expo-image-picker');
        const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
        return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
      }
      case 'location': {
        const Location = await import('expo-location');
        const { status } = await Location.getForegroundPermissionsAsync();
        return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
      }
      case 'notifications': {
        const Notifications = await import('expo-notifications');
        const { status } = await Notifications.getPermissionsAsync();
        return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
      }
      case 'biometric': {
        const LocalAuth = await import('expo-local-authentication');
        const compatible = await LocalAuth.hasHardwareAsync();
        if (!compatible) return 'unavailable';
        const enrolled = await LocalAuth.isEnrolledAsync();
        return enrolled ? 'granted' : 'undetermined';
      }
      case 'microphone': {
        try {
          const { Audio } = await import('expo-av');
          const result = await (Audio as unknown as { getPermissionsAsync?: () => Promise<{ status?: string; granted?: boolean }> }).getPermissionsAsync?.();
          if (result) {
            const s = result.status ?? result.granted;
            if (s === 'granted' || s === true) return 'granted';
            if (s === 'denied' || s === false) return 'denied';
          }
        } catch {
          /* expo-av bazen getPermissionsAsync sunmuyor */
        }
        return 'undetermined';
      }
      default:
        return 'undetermined';
    }
  } catch {
    return 'unavailable';
  }
}

async function requestPermission(key: string): Promise<PermStatus> {
  try {
    switch (key) {
      case 'camera': {
        try {
          const Camera = await import('expo-camera');
          const { status } = await Camera.requestCameraPermissionsAsync();
          return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
        } catch {
          return await getStatus('camera');
        }
      }
      case 'photo_library': {
        const ImagePicker = await import('expo-image-picker');
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
      }
      case 'location': {
        const Location = await import('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
      }
      case 'notifications': {
        const Notifications = await import('expo-notifications');
        const { status } = await Notifications.requestPermissionsAsync();
        return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
      }
      case 'biometric':
        // Ayarlardan yönetilir
        await openAppSettings();
        return await getStatus(key);
      case 'microphone': {
        const Audio = await import('expo-av').then((m) => m.Audio);
        const result = await Audio.requestPermissionsAsync();
        const status = result?.status ?? result?.granted;
        if (status === 'granted' || status === true) return 'granted';
        if (status === 'denied' || status === false) return 'denied';
        return 'undetermined';
      }
      default:
        return 'undetermined';
    }
  } catch (e) {
    Alert.alert('Hata', (e as Error)?.message ?? 'İzin alınamadı.');
    return await getStatus(key);
  }
}

function openAppSettings(): Promise<void> {
  return Linking.openSettings();
}

export default function PermissionsScreen() {
  const [statuses, setStatuses] = useState<Record<string, PermStatus>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const refreshAll = useCallback(async () => {
    const next: Record<string, PermStatus> = {};
    for (const p of DEVICE_PERMISSIONS) {
      next[p.key] = await getStatus(p.key);
    }
    setStatuses(next);
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useFocusEffect(
    useCallback(() => {
      refreshAll();
    }, [refreshAll])
  );

  const onPress = useCallback(
    async (key: string) => {
      const current = statuses[key];
      setLoading((prev) => ({ ...prev, [key]: true }));
      const loadingTimeout = setTimeout(() => {
        setLoading((prev) => (prev[key] ? { ...prev, [key]: false } : prev));
      }, 15000);
      try {
        if (current === 'granted') {
          await openAppSettings();
          setTimeout(refreshAll, 500);
        } else {
          const next = await requestPermission(key);
          setStatuses((prev) => ({ ...prev, [key]: next }));
        }
      } finally {
        clearTimeout(loadingTimeout);
        setLoading((prev) => ({ ...prev, [key]: false }));
      }
    },
    [statuses, refreshAll]
  );

  const statusLabel = (s: PermStatus) => {
    switch (s) {
      case 'granted':
        return 'Verildi';
      case 'denied':
        return 'Kapalı';
      case 'undetermined':
        return 'İstenmedi';
      default:
        return 'Kullanılamıyor';
    }
  };

  const actionHint = (key: string, s: PermStatus) => {
    if (s === 'granted') return 'İptal etmek için dokunun (ayarlar açılır)';
    if (s === 'unavailable') return 'Bu cihazda desteklenmiyor';
    return 'İzin vermek için dokunun';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Her satıra dokunarak izin verebilir veya verilmiş izni iptal etmek için ayarları açabilirsiniz.
      </Text>

      {DEVICE_PERMISSIONS.map((p) => {
        const status = statuses[p.key] ?? 'undetermined';
        const busy = loading[p.key];
        const unavailable = status === 'unavailable';
        const canTap = !unavailable || p.key === 'camera';
        return (
          <TouchableOpacity
            key={p.key}
            style={[styles.permRow, unavailable && p.key !== 'camera' && styles.permRowDisabled]}
            onPress={() => !busy && onPress(p.key)}
            disabled={busy}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          >
            <View style={[styles.permIconWrap, status === 'granted' && styles.permIconWrapGranted]}>
              <Ionicons
                name={p.icon}
                size={22}
                color={status === 'granted' ? theme.colors.success : theme.colors.primary}
              />
            </View>
            <View style={styles.permBody}>
              <View style={styles.permTitleRow}>
                <Text style={styles.permTitle}>{p.title}</Text>
                {busy ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <View style={[styles.badge, status === 'granted' && styles.badgeGranted]}>
                    <Text style={[styles.badgeText, status === 'granted' && styles.badgeTextGranted]}>
                      {statusLabel(status)}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.permReason}>{p.reason}</Text>
              {canTap && (
                <Text style={styles.permHint}>{actionHint(p.key, status)}</Text>
              )}
            </View>
            {!busy && (
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            )}
          </TouchableOpacity>
        );
      })}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          İzin metinleri cihazınızda ilk kullanımda veya ayarlar üzerinden görüntülenebilir.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  intro: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: 24,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: 14,
    borderRadius: theme.radius.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  permRowDisabled: {
    opacity: 0.8,
  },
  permIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  permIconWrapGranted: {
    backgroundColor: theme.colors.success + '20',
  },
  permBody: { flex: 1, minWidth: 0 },
  permTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 8,
  },
  permTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  permReason: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  permHint: {
    fontSize: 12,
    color: theme.colors.primary,
    marginTop: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: theme.colors.borderLight,
  },
  badgeGranted: {
    backgroundColor: theme.colors.success + '25',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  badgeTextGranted: {
    color: theme.colors.success,
  },
  footer: {
    marginTop: 28,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  footerText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
});
