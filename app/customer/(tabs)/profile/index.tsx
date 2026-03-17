import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { uriToArrayBuffer } from '@/lib/uploadMedia';
import { theme } from '@/constants/theme';
import { LANGUAGES, LANG_STORAGE_KEY, type LangCode } from '@/i18n';
import { CachedImage } from '@/components/CachedImage';

const AVATAR_SIZE = 88;
const COVER_BLOCK_HEIGHT = 240;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const LANGUAGE_FLAGS: Record<string, string> = {
  tr: '🇹🇷',
  en: '🇬🇧',
  ar: '🇸🇦',
  de: '🇩🇪',
  fr: '🇫🇷',
  ru: '🇷🇺',
  es: '🇪🇸',
};

function getDisplayName(t: (key: string) => string): string {
  const { user } = useAuthStore.getState();
  if (!user) return t('guestDefaultName');
  const name = user.user_metadata?.full_name ?? user.user_metadata?.name;
  if (name && typeof name === 'string') return name.trim();
  const email = user.email ?? (user.user_metadata?.email as string) ?? '';
  const part = email.split('@')[0];
  if (part) return part.charAt(0).toUpperCase() + part.slice(1);
  return t('guestDefaultName');
}

/** Apple ile giriş yapan hesaplar da mail ile kayıt sayılır; email user_metadata'da da olabilir. */
function getDisplayEmail(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null): string {
  if (!user) return '';
  return (user.email ?? (user.user_metadata?.email as string) ?? '').trim();
}

export default function CustomerProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { user, signOut, loadSession } = useAuthStore();
  const isLoggedIn = !!user;

  const coverUrl = (user?.user_metadata?.cover_url as string) || null;
  const avatarUrl = (user?.user_metadata?.avatar_url as string) || null;

  const [coverUri, setCoverUri] = useState<string | null>(coverUrl);
  const [avatarUri, setAvatarUri] = useState<string | null>(avatarUrl);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [coverModalVisible, setCoverModalVisible] = useState(false);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  useEffect(() => {
    setCoverUri(coverUrl);
    setAvatarUri(avatarUrl);
  }, [coverUrl, avatarUrl]);

  const saveUserMetadata = async (updates: Record<string, unknown>) => {
    if (!user) return;
    const next = { ...(user.user_metadata || {}), ...updates };
    await supabase.auth.updateUser({ data: next });
    await loadSession();
  };

  const pickCover = async () => {
    if (!user) return;
    const { status: statusCover } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (statusCover !== 'granted') {
      Alert.alert(t('permission'), t('galleryRequired'));
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 1],
        quality: 0.7,
      });
      if (result.canceled || !result.assets[0]?.uri) return;
      setUploadingCover(true);
      const arrayBuffer = await uriToArrayBuffer(result.assets[0].uri);
      const path = `customer/${user.id}/cover_${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('profiles').upload(path, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('profiles').getPublicUrl(path);
      await saveUserMetadata({ cover_url: publicUrl });
      setCoverUri(publicUrl);
    } catch (e) {
      Alert.alert(t('error'), (e as Error)?.message ?? t('coverUploadError'));
    } finally {
      setUploadingCover(false);
    }
  };

  const pickAvatar = async () => {
    if (!user) return;
    const { status: statusAvatar } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (statusAvatar !== 'granted') {
      Alert.alert(t('permission'), t('galleryRequired'));
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
      });
      if (result.canceled || !result.assets[0]?.uri) return;
      setUploadingAvatar(true);
      const arrayBuffer = await uriToArrayBuffer(result.assets[0].uri);
      const path = `customer/${user.id}/avatar_${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('profiles').upload(path, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('profiles').getPublicUrl(path);
      await saveUserMetadata({ avatar_url: publicUrl });
      setAvatarUri(publicUrl);
    } catch (e) {
      Alert.alert(t('error'), (e as Error)?.message ?? t('avatarUploadError'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      t('signOut'),
      t('signOutConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('signOut'),
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/');
          },
        },
      ]
    );
  };

  const handleLanguageSelect = (code: LangCode) => {
    i18n.changeLanguage(code);
    AsyncStorage.setItem(LANG_STORAGE_KEY, code);
    setLanguageModalVisible(false);
  };

  const displayName = getDisplayName(t);
  const displayEmail = getDisplayEmail(user);
  const showCover = coverUri || isLoggedIn;
  const showAvatarEdit = isLoggedIn;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Kapak sabit yükseklikte; profil resmi kapak alt kenarına sabit, hep aynı yerde. */}
      {showCover ? (
        <View style={styles.coverBlock}>
          <View style={styles.coverImageClip}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={() => {
                if (uploadingCover) return;
                if (coverUri) setCoverModalVisible(true);
                else pickCover();
              }}
              activeOpacity={1}
            >
              {coverUri ? (
                <CachedImage uri={coverUri} style={styles.coverBackground} contentFit="cover" />
              ) : (
                <View style={styles.coverPlaceholder}>
                  <Ionicons name="image-outline" size={36} color={theme.colors.textMuted} />
                  <Text style={styles.coverPlaceholderText}>Kapak fotoğrafı ekle</Text>
                </View>
              )}
            </TouchableOpacity>
            {uploadingCover && (
              <View style={styles.coverUploadOverlay}>
                <Text style={styles.uploadText}>Yükleniyor</Text>
              </View>
            )}
            {showAvatarEdit && !uploadingCover && (
              <TouchableOpacity style={styles.coverCameraBtn} onPress={pickCover} activeOpacity={0.9}>
                <Ionicons name="camera" size={20} color={theme.colors.white} />
              </TouchableOpacity>
            )}
          </View>
          {/* Avatar — kapak alt kenarına sabit */}
          <View style={styles.avatarOnCover}>
            <TouchableOpacity
              style={styles.avatarWrap}
              onPress={() => {
                if (uploadingAvatar) return;
                if (avatarUri) setAvatarModalVisible(true);
                else if (isLoggedIn) pickAvatar();
              }}
              activeOpacity={0.95}
              disabled={!isLoggedIn && !avatarUri}
            >
              {avatarUri ? (
                <CachedImage uri={avatarUri} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              {uploadingAvatar && (
                <View style={styles.avatarUploadOverlay}>
                  <Text style={styles.uploadText}>Yükleniyor</Text>
                </View>
              )}
              {showAvatarEdit && !uploadingAvatar && (
                <TouchableOpacity
                  style={styles.avatarCameraBtn}
                  onPress={(e) => { e?.stopPropagation?.(); pickAvatar(); }}
                  activeOpacity={0.9}
                >
                  <Ionicons name="camera" size={18} color={theme.colors.white} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.headerNoCover}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          {displayEmail ? (
            <Text style={styles.email}>{displayEmail}</Text>
          ) : (
            <Text style={styles.subtitle}>Giriş yaparak rezervasyon ve mesajlarınıza erişin.</Text>
          )}
        </View>
      )}

      {/* İsim / email — kapak bloğunun altında (avatar varsa avatarın altından sonra) */}
      {showCover && (
        <View style={styles.header}>
          <Text style={styles.name}>{displayName}</Text>
          {displayEmail ? (
            <Text style={styles.email}>{displayEmail}</Text>
          ) : (
            <Text style={styles.subtitle}>Giriş yaparak rezervasyon ve mesajlarınıza erişin.</Text>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hesap</Text>
        <TouchableOpacity style={styles.menuCard} onPress={() => setLanguageModalVisible(true)} activeOpacity={0.7}>
          <View style={styles.menuIconWrap}>
            <Ionicons name="language-outline" size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.menuTextWrap}>
            <Text style={styles.menuLabel}>{t('language')}</Text>
            <Text style={styles.menuSublabel}>{LANGUAGES.find((l) => l.code === (i18n.language || '').split('-')[0])?.label ?? t('selectLanguage')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} style={styles.menuChevron} />
        </TouchableOpacity>
        {isLoggedIn && (
          <TouchableOpacity style={styles.menuCard} onPress={() => router.push('/customer/profile/edit')} activeOpacity={0.7}>
            <View style={styles.menuIconWrap}>
              <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={styles.menuLabel}>Profil bilgilerini düzenle</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} style={styles.menuChevron} />
          </TouchableOpacity>
        )}
        {!isLoggedIn && (
          <TouchableOpacity style={styles.primaryMenuCard} onPress={() => router.push('/auth')} activeOpacity={0.85}>
            <Ionicons name="person-add-outline" size={22} color={theme.colors.white} style={{ marginRight: 10 }} />
            <Text style={styles.primaryMenuCardText}>Giriş yap / Kayıt ol</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.menuCard} onPress={() => router.push('/customer/key')} activeOpacity={0.7}>
          <View style={styles.menuIconWrap}>
            <Ionicons name="key-outline" size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.menuTextWrap}>
            <Text style={styles.menuLabel}>Dijital Anahtar</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} style={styles.menuChevron} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuCard} onPress={() => router.push('/customer/emergency')} activeOpacity={0.7}>
          <View style={[styles.menuIconWrap, styles.menuIconWrapDanger]}>
            <Ionicons name="alert-circle-outline" size={20} color={theme.colors.error} />
          </View>
          <View style={styles.menuTextWrap}>
            <Text style={[styles.menuLabel, { color: theme.colors.error }]}>Acil durum / Yardım</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} style={styles.menuChevron} />
        </TouchableOpacity>
      </View>

      {isLoggedIn && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hesap yönetimi</Text>
          <TouchableOpacity style={styles.menuCard} onPress={() => router.push('/customer/profile/delete-account')} activeOpacity={0.7}>
            <View style={[styles.menuIconWrap, styles.menuIconWrapDanger]}>
              <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={[styles.menuLabel, styles.signOutText]}>Hesabımı sil</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} style={styles.menuChevron} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('legalAndContact')}</Text>
        <TouchableOpacity style={styles.menuCard} onPress={() => router.push({ pathname: '/legal/[type]', params: { type: 'privacy' } })} activeOpacity={0.7}>
          <View style={styles.menuIconWrap}>
            <Ionicons name="document-text-outline" size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.menuTextWrap}>
            <Text style={styles.menuLabel}>{t('privacyPolicy')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} style={styles.menuChevron} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuCard} onPress={() => router.push({ pathname: '/legal/[type]', params: { type: 'terms' } })} activeOpacity={0.7}>
          <View style={styles.menuIconWrap}>
            <Ionicons name="list-outline" size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.menuTextWrap}>
            <Text style={styles.menuLabel}>{t('termsOfService')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} style={styles.menuChevron} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuCard} onPress={() => router.push({ pathname: '/legal/[type]', params: { type: 'cookies' } })} activeOpacity={0.7}>
          <View style={styles.menuIconWrap}>
            <Ionicons name="nutrition-outline" size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.menuTextWrap}>
            <Text style={styles.menuLabel}>{t('cookiePolicy')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} style={styles.menuChevron} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuCard} onPress={() => router.push('/permissions')} activeOpacity={0.7}>
          <View style={styles.menuIconWrap}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.menuTextWrap}>
            <Text style={styles.menuLabel}>İzinler</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} style={styles.menuChevron} />
        </TouchableOpacity>
        <Text style={styles.contactLabel}>{t('contact')}: support@litxtech.com</Text>
      </View>

      {isLoggedIn && (
        <View style={styles.section}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.85}>
            <Ionicons name="log-out-outline" size={20} color={theme.colors.error} style={{ marginRight: 8 }} />
            <Text style={styles.signOutButtonText}>{t('signOut')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Kapak tam ekran */}
      <Modal visible={coverModalVisible} transparent animationType="fade" onRequestClose={() => setCoverModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCoverModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            {coverUri ? <CachedImage uri={coverUri} style={styles.modalImage} contentFit="contain" /> : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Avatar tam ekran */}
      <Modal visible={avatarModalVisible} transparent animationType="fade" onRequestClose={() => setAvatarModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setAvatarModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            {avatarUri ? <CachedImage uri={avatarUri} style={styles.modalImage} contentFit="contain" /> : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Dil seçimi — modern kart */}
      <Modal visible={languageModalVisible} transparent animationType="fade" onRequestClose={() => setLanguageModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setLanguageModalVisible(false)}>
          <Pressable
            style={[
              styles.langModalContent,
              {
                paddingTop: insets.top + 24,
                paddingBottom: insets.bottom + 24,
                maxHeight: SCREEN_HEIGHT * 0.82,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.langModalHeader}>
              <View style={styles.langModalIconWrap}>
                <Ionicons name="globe-outline" size={32} color={theme.colors.primary} />
              </View>
              <Text style={styles.langModalTitle}>{t('selectLanguage')}</Text>
              <Text style={styles.langModalSubtitle}>Uygulama dilinizi aşağıdan seçin</Text>
            </View>
            <ScrollView
              style={styles.langScrollView}
              contentContainerStyle={styles.langScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {LANGUAGES.map(({ code, label }) => {
                const isActive = (i18n.language || '').split('-')[0] === code;
                const flag = LANGUAGE_FLAGS[code] ?? '🌐';
                return (
                  <TouchableOpacity
                    key={code}
                    style={[styles.langOptionCard, isActive && styles.langOptionCardActive]}
                    onPress={() => handleLanguageSelect(code)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.langOptionLeft, isActive && styles.langOptionLeftActive]}>
                      <Text style={styles.langOptionFlag}>{flag}</Text>
                      <Text style={[styles.langOptionLabel, isActive && styles.langOptionLabelActive]}>{label}</Text>
                    </View>
                    {isActive ? (
                      <View style={styles.langOptionCheckWrap}>
                        <Ionicons name="checkmark-circle" size={26} color={theme.colors.white} />
                      </View>
                    ) : (
                      <View style={styles.langOptionChevron}>
                        <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.langCloseBtn}
              onPress={() => setLanguageModalVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.langCloseText}>{t('close')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  content: { paddingBottom: theme.spacing.xxl + 24 },
  coverBlock: {
    width: SCREEN_WIDTH,
    height: COVER_BLOCK_HEIGHT,
    position: 'relative',
    overflow: 'visible',
    alignSelf: 'stretch',
  },
  coverImageClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: COVER_BLOCK_HEIGHT,
    overflow: 'hidden',
  },
  coverBackground: {
    ...StyleSheet.absoluteFillObject,
    width: SCREEN_WIDTH,
    height: COVER_BLOCK_HEIGHT,
  },
  coverPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  coverPlaceholderText: { color: theme.colors.textMuted, fontSize: 14 },
  coverUploadOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverCameraBtn: {
    position: 'absolute',
    bottom: 10,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadText: { color: theme.colors.white, fontSize: 12 },
  avatarOnCover: {
    position: 'absolute',
    bottom: -AVATAR_SIZE / 2 + 55,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingTop: AVATAR_SIZE / 2 + 12,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  headerNoCover: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 12,
    ...theme.shadows.md,
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 4,
    borderColor: theme.colors.surface,
    backgroundColor: theme.colors.borderLight,
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: theme.colors.surface,
  },
  avatarText: { fontSize: 36, fontWeight: '700', color: theme.colors.white },
  avatarUploadOverlay: {
    position: 'absolute',
    inset: 0,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCameraBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.surface,
    ...theme.shadows.sm,
  },
  name: { ...theme.typography.title, color: theme.colors.text, marginBottom: 4 },
  email: { ...theme.typography.bodySmall, color: theme.colors.textSecondary },
  subtitle: { ...theme.typography.bodySmall, color: theme.colors.textSecondary },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  sectionTitle: {
    ...theme.typography.bodySmall,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 12,
    paddingTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    ...theme.shadows.sm,
  },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primaryLight + '22',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuIconWrapDanger: {
    backgroundColor: theme.colors.error + '18',
  },
  menuTextWrap: { flex: 1 },
  menuLabel: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
  menuSublabel: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  menuChevron: { marginLeft: 8 },
  signOutText: { color: theme.colors.error, fontWeight: '600' },
  signOutButton: {
    flexDirection: 'row',
    marginTop: theme.spacing.sm,
    paddingVertical: 16,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    borderWidth: 2,
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.error + '12',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },
  signOutButtonText: { fontSize: 16, fontWeight: '700', color: theme.colors.error },
  primaryMenuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: 16,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: 10,
    ...theme.shadows.md,
  },
  primaryMenuCardText: { fontSize: 16, fontWeight: '700', color: theme.colors.white },
  contactLabel: { ...theme.typography.bodySmall, color: theme.colors.textSecondary, marginTop: 16, marginBottom: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.85, justifyContent: 'center' },
  modalImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.85 },
  langModalContent: {
    width: Math.min(SCREEN_WIDTH - 32, 400),
    alignSelf: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    paddingHorizontal: 24,
    marginHorizontal: 16,
    ...theme.shadows.md,
    shadowRadius: 16,
    elevation: 8,
  },
  langModalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  langModalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primaryLight + '28',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  langModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  langModalSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  langScrollView: { maxHeight: 340 },
  langScrollContent: { paddingBottom: 8 },
  langOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 12,
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.sm,
  },
  langOptionCardActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primaryDark,
    ...theme.shadows.md,
  },
  langOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  langOptionLeftActive: {},
  langOptionFlag: {
    fontSize: 28,
  },
  langOptionLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.text,
  },
  langOptionLabelActive: {
    color: theme.colors.white,
    fontWeight: '700',
  },
  langOptionCheckWrap: {},
  langOptionChevron: { opacity: 0.7 },
  langCloseBtn: {
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: theme.colors.backgroundSecondary,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  langCloseText: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '700',
  },
});
