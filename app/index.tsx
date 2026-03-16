import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { log } from '@/lib/logger';
import { startGeofenceWatch, stopGeofenceWatch, type HotelGeofenceConfig } from '@/lib/geofencing';
import { hasPolicyConsent } from '@/lib/policyConsent';

const HOTEL_COORDS: HotelGeofenceConfig | null =
  typeof process.env.EXPO_PUBLIC_HOTEL_LAT !== 'undefined' &&
  typeof process.env.EXPO_PUBLIC_HOTEL_LON !== 'undefined'
    ? {
        latitude: Number(process.env.EXPO_PUBLIC_HOTEL_LAT),
        longitude: Number(process.env.EXPO_PUBLIC_HOTEL_LON),
        radius: 500,
      }
    : null;

export default function HomeScreen() {
  const router = useRouter();
  const { user, staff, loading, loadSession } = useAuthStore();
  const notifiedNearby = useRef(false);

  useEffect(() => {
    log.info('HomeScreen', 'loadSession tetikleniyor');
    loadSession();
  }, []);

  // Konum: Otele yaklaşınca "Check-in yapmak ister misiniz?" bildirimi
  useEffect(() => {
    if (!HOTEL_COORDS || staff) return;
    startGeofenceWatch(
      HOTEL_COORDS,
      (distance) => {
        if (notifiedNearby.current) return;
        notifiedNearby.current = true;
        Alert.alert(
          'Valoria Hotel',
          'Otele yakınsınız. Check-in yapmak ister misiniz?',
          [
            { text: 'Hayır', style: 'cancel', onPress: () => { notifiedNearby.current = false; } },
            { text: 'Evet', onPress: () => router.push('/guest') },
          ]
        );
      },
      (e) => log.warn('HomeScreen', 'Geofence', e?.message)
    );
    return () => stopGeofenceWatch();
  }, [staff]);

  useEffect(() => {
    if (loading) return;
    if (staff) {
      log.info('HomeScreen', 'staff var, /admin yönlendiriliyor');
      router.replace('/admin');
      return;
    }
    log.info('HomeScreen', 'ana ekran gösteriliyor (giriş yok)');
  }, [loading, staff]);

  useEffect(() => {
    if (!loading) log.info('HomeScreen', 'durum', { hasStaff: !!staff, hasUser: !!user });
  }, [loading, staff, user]);

  const goToCustomer = async () => {
    const accepted = await hasPolicyConsent();
    if (accepted) router.replace('/customer');
    else router.push({ pathname: '/policies', params: { next: 'customer' } });
  };

  const goToGuest = async () => {
    const accepted = await hasPolicyConsent();
    if (accepted) router.replace('/guest');
    else router.push({ pathname: '/policies', params: { next: 'guest' } });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Valoria Hotel</Text>
        <Text style={styles.subtitle}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.centered}>
      <Text style={styles.title}>Valoria Hotel</Text>
      <Text style={styles.subtitle}>Konaklama Sözleşmesi</Text>
      <TouchableOpacity style={styles.primaryButton} onPress={goToCustomer}>
        <Text style={styles.primaryButtonText}>Müşteri Uygulaması</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={goToGuest}>
        <Text style={styles.secondaryButtonText}>QR ile Sözleşme Onayı</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.secondaryButton, { marginTop: 0 }]} onPress={() => router.push('/admin/login')}>
        <Text style={styles.secondaryButtonText}>Personel Girişi</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.secondaryButton, { marginTop: 8 }]} onPress={() => router.push('/auth')}>
        <Text style={styles.secondaryButtonText}>E-posta ile giriş / kayıt</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a365d',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 48,
  },
  primaryButton: {
    backgroundColor: '#ed8936',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    fontWeight: '600',
  },
});
