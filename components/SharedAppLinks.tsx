/**
 * Admin tarafından paylaşılan uygulama ve web sitesi linkleri.
 * Personel, misafir ve admin dahil herkes görebilir.
 */
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { listAdminAppLinks, type AdminAppLink } from '@/lib/adminAppLinks';
import { CachedImage } from '@/components/CachedImage';
import { useAuthStore } from '@/stores/authStore';
import { theme } from '@/constants/theme';

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  app_store: 'logo-apple-appstore',
  google_play: 'logo-google-playstore',
  globe: 'globe-outline',
  custom: 'image-outline',
};

function AppLinkRow({
  link,
  onManage,
  isAdmin,
  compact,
  fullWidth,
}: {
  link: AdminAppLink;
  onManage?: () => void;
  isAdmin?: boolean;
  compact?: boolean;
  /** Tam genişlik dikey liste (ayrı sayfa) */
  fullWidth?: boolean;
}) {
  const iconName = ICON_MAP[link.icon_type] ?? 'link';
  const iconSize = compact ? 22 : fullWidth ? 24 : 28;

  const content = (
    <TouchableOpacity
      style={[styles.row, compact && styles.rowCompact, fullWidth && styles.rowPage]}
      onPress={() => {
        const url = link.url?.trim();
        if (url) {
          const href = url.startsWith('http') ? url : `https://${url}`;
          Linking.openURL(href).catch(() => {});
        }
      }}
      activeOpacity={0.7}
    >
      <View style={[styles.iconWrap, compact && styles.iconWrapCompact, fullWidth && styles.iconWrapPage]}>
        {link.icon_type === 'custom' && link.icon_url ? (
          <CachedImage
            uri={link.icon_url}
            style={[styles.iconImg, { width: iconSize, height: iconSize }]}
            contentFit="cover"
          />
        ) : (
          <Ionicons name={iconName} size={iconSize} color={theme.colors.primary} />
        )}
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowName, compact && styles.rowNameCompact, fullWidth && styles.rowNamePage]} numberOfLines={2}>
          {link.name}
        </Text>
        {!compact && (
          <Text style={styles.rowType} numberOfLines={1}>
            {link.type === 'app' ? 'Uygulama' : 'Web sitesi'}
          </Text>
        )}
      </View>
      <Ionicons name="open-outline" size={18} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );

  if (isAdmin && onManage) {
    return (
      <TouchableOpacity
        onLongPress={onManage}
        delayLongPress={400}
        style={styles.rowWrapper}
        activeOpacity={1}
      >
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

type SharedAppLinksProps = {
  /** Admin profilinde "Yönet" butonu göster */
  showManageButton?: boolean;
  /** Daha kompakt satırlar */
  compact?: boolean;
  /** Başlık (varsayılan: "Uygulamalar & Web Siteleri") */
  title?: string;
  /**
   * `page`: ayrı ekran — yükleniyor/boş durumlarını göster, dikey tam genişlik liste.
   * `embed` (varsayılan): profil vb. — boşta veya yüklenirken hiçbir şey gösterme.
   */
  layout?: 'embed' | 'page';
};

export function SharedAppLinks({
  showManageButton,
  compact,
  title = 'Uygulamalar & Web Siteleri',
  layout = 'embed',
}: SharedAppLinksProps) {
  const router = useRouter();
  const { staff } = useAuthStore();
  const isAdmin = staff?.role === 'admin';
  const [links, setLinks] = useState<AdminAppLink[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await listAdminAppLinks();
      setLinks(data);
    } catch {
      setLinks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (layout === 'embed') {
    if (loading) return null;
    if (links.length === 0) return null;
  }

  if (layout === 'page' && loading) {
    return (
      <View style={styles.pageState}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.pageStateHint}>Yükleniyor…</Text>
      </View>
    );
  }

  if (layout === 'page' && links.length === 0) {
    return (
      <View style={styles.pageState}>
        <Ionicons name="link-outline" size={48} color={theme.colors.textMuted} />
        <Text style={styles.pageEmptyTitle}>Henüz link yok</Text>
        <Text style={styles.pageEmptySub}>Yönetim paylaştığında uygulama ve web adresleri burada listelenir.</Text>
      </View>
    );
  }

  const isPage = layout === 'page';

  return (
    <View style={[styles.section, isPage && styles.sectionPage]}>
      {!isPage && (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {showManageButton && isAdmin && (
            <TouchableOpacity onPress={() => router.push('/admin/app-links')} style={styles.manageBtn}>
              <Ionicons name="create-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.manageBtnText}>Yönet</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {isPage && showManageButton && isAdmin && (
        <TouchableOpacity onPress={() => router.push('/admin/app-links')} style={styles.pageManageRow}>
          <Ionicons name="create-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.manageBtnText}>Yönetimde düzenle</Text>
        </TouchableOpacity>
      )}
      {compact && !isPage ? (
        <View style={styles.listVertical}>
          {links.map((link) => (
            <AppLinkRow
              key={link.id}
              link={link}
              isAdmin={isAdmin}
              compact
              onManage={showManageButton ? () => router.push('/admin/app-links') : undefined}
            />
          ))}
        </View>
      ) : isPage ? (
        <View style={styles.listVerticalPage}>
          {links.map((link) => (
            <AppLinkRow
              key={link.id}
              link={link}
              isAdmin={isAdmin}
              fullWidth
              onManage={showManageButton ? () => router.push('/admin/app-links') : undefined}
            />
          ))}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listHorizontal}
        >
          {links.map((link) => (
            <AppLinkRow
              key={link.id}
              link={link}
              isAdmin={isAdmin}
              compact={false}
              onManage={showManageButton ? () => router.push('/admin/app-links') : undefined}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 20,
    marginBottom: 8,
  },
  sectionPage: {
    marginTop: 0,
    marginBottom: 0,
  },
  pageState: {
    paddingVertical: 48,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageStateHint: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  pageEmptyTitle: {
    marginTop: 16,
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
  },
  pageEmptySub: {
    marginTop: 8,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  pageManageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    marginBottom: 12,
  },
  listVerticalPage: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  manageBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  listHorizontal: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 16,
  },
  listVertical: {
    gap: 8,
  },
  rowWrapper: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    minWidth: 200,
  },
  rowCompact: {
    padding: 10,
    minWidth: 0,
    flex: 1,
  },
  rowPage: {
    minWidth: 0,
    width: '100%',
    alignSelf: 'stretch',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(26,54,93,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconWrapCompact: {
    width: 36,
    height: 36,
    marginRight: 10,
  },
  iconWrapPage: {
    width: 40,
    height: 40,
  },
  iconImg: {
    borderRadius: 8,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  rowNameCompact: {
    fontSize: 14,
  },
  rowNamePage: {
    fontSize: 15,
  },
  rowType: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
});
