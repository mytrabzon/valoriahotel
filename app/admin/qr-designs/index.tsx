import { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { DesignableQR, type QRDesign } from '@/components/DesignableQR';
import { FIXED_CONTRACT_QR_URL } from '@/constants/contractQr';

type Template = {
  id: string;
  name: string;
  category: string;
  use_logo: boolean;
  background_color: string;
  foreground_color: string;
  shape: 'square' | 'rounded' | 'dots' | 'circle';
  logo_size_ratio: number;
  sort_order: number;
};

type SettingsRow = {
  id: string;
  scope: string;
  template_id: string | null;
  use_logo_override: boolean | null;
  background_color_override: string | null;
  foreground_color_override: string | null;
  shape_override: string | null;
  template?: Template | null;
};

const SAMPLE_QR_VALUE = FIXED_CONTRACT_QR_URL;
const SHAPE_LABELS: Record<string, string> = {
  square: 'Kare',
  rounded: 'Yuvarlatılmış',
  dots: 'Noktalı',
  circle: 'Yuvarlak',
};
const PRESET_COLORS = ['#FFFFFF', '#000000', '#B8860B', '#1a365d', '#2D3748', '#E2E8F0', '#F7FAFC'];

function resolveDesign(template: Template | null, settings: SettingsRow | null, scope: string): QRDesign | null {
  if (!template && !settings?.template_id) return null;
  const t = template ?? (settings?.template as Template);
  if (!t) return null;
  return {
    useLogo: settings?.use_logo_override ?? t.use_logo,
    backgroundColor: settings?.background_color_override ?? t.background_color,
    foregroundColor: settings?.foreground_color_override ?? t.foreground_color,
    shape: (settings?.shape_override as QRDesign['shape']) ?? t.shape,
    logoSizeRatio: Number(t.logo_size_ratio) || 0.24,
  };
}

export default function QRDesignsPage() {
  const [roomTemplates, setRoomTemplates] = useState<Template[]>([]);
  const [avatarTemplates, setAvatarTemplates] = useState<Template[]>([]);
  const [roomSettings, setRoomSettings] = useState<SettingsRow | null>(null);
  const [avatarSettings, setAvatarSettings] = useState<SettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [roomOverride, setRoomOverride] = useState<Partial<SettingsRow>>({});
  const [avatarOverride, setAvatarOverride] = useState<Partial<SettingsRow>>({});
  const { width } = useWindowDimensions();
  const cardSize = width < 400 ? (width - 48) / 2 - 8 : 100;
  const qrPreviewSize = Math.min(80, cardSize - 24);

  const load = async () => {
    const [tRes, sRes] = await Promise.all([
      supabase.from('qr_design_templates').select('*').order('sort_order'),
      supabase.from('qr_design_settings').select('*'),
    ]);
    const templates = (tRes.data ?? []) as Template[];
    setRoomTemplates(templates.filter((t) => t.category === 'room'));
    setAvatarTemplates(templates.filter((t) => t.category === 'avatar'));

    const settings = (sRes.data ?? []) as SettingsRow[];
    const roomS = settings.find((s) => s.scope === 'room') ?? null;
    const avatarS = settings.find((s) => s.scope === 'avatar') ?? null;

    const templateById = (id: string) => templates.find((t) => t.id === id) ?? null;
    setRoomSettings(roomS ? { ...roomS, template: templateById(roomS.template_id ?? '') } : null);
    setAvatarSettings(avatarS ? { ...avatarS, template: templateById(avatarS.template_id ?? '') } : null);
    setRoomOverride({
      use_logo_override: roomS?.use_logo_override ?? undefined,
      background_color_override: roomS?.background_color_override ?? undefined,
      foreground_color_override: roomS?.foreground_color_override ?? undefined,
      shape_override: roomS?.shape_override ?? undefined,
    });
    setAvatarOverride({
      use_logo_override: avatarS?.use_logo_override ?? undefined,
      background_color_override: avatarS?.background_color_override ?? undefined,
      foreground_color_override: avatarS?.foreground_color_override ?? undefined,
      shape_override: avatarS?.shape_override ?? undefined,
    });
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const activeRoomTemplate = useMemo(
    () => roomSettings?.template ?? roomTemplates.find((t) => t.id === roomSettings?.template_id) ?? roomTemplates[0] ?? null,
    [roomSettings, roomTemplates]
  );
  const activeAvatarTemplate = useMemo(
    () => avatarSettings?.template ?? avatarTemplates.find((t) => t.id === avatarSettings?.template_id) ?? avatarTemplates[0] ?? null,
    [avatarSettings, avatarTemplates]
  );
  const roomDesign = useMemo(
    () => resolveDesign(activeRoomTemplate, roomSettings ? { ...roomSettings, ...roomOverride } : null, 'room'),
    [activeRoomTemplate, roomSettings, roomOverride]
  );
  const avatarDesign = useMemo(
    () => resolveDesign(activeAvatarTemplate, avatarSettings ? { ...avatarSettings, ...avatarOverride } : null, 'avatar'),
    [activeAvatarTemplate, avatarSettings, avatarOverride]
  );

  const saveSettings = async (scope: 'room' | 'avatar') => {
    const templateId = scope === 'room'
      ? (roomSettings?.template_id ?? roomTemplates[0]?.id)
      : (avatarSettings?.template_id ?? avatarTemplates[0]?.id);
    if (!templateId) {
      Alert.alert('Hata', 'Önce bir şablon seçin.');
      return;
    }
    setSaving(scope);
    const override = scope === 'room' ? roomOverride : avatarOverride;
    const { error } = await supabase.from('qr_design_settings').upsert({
      scope,
      template_id: templateId,
      use_logo_override: override.use_logo_override ?? null,
      background_color_override: override.background_color_override || null,
      foreground_color_override: override.foreground_color_override || null,
      shape_override: override.shape_override || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'scope' });
    setSaving(null);
    if (error) Alert.alert('Hata', error.message);
    else await load();
  };

  const setActiveTemplate = (scope: 'room' | 'avatar', templateId: string) => {
    if (scope === 'room') {
      const template = roomTemplates.find((t) => t.id === templateId) ?? null;
      setRoomSettings((prev) => (prev ? { ...prev, template_id: templateId, template } : { id: '', scope: 'room', template_id: templateId, template } as SettingsRow));
    } else {
      const template = avatarTemplates.find((t) => t.id === templateId) ?? null;
      setAvatarSettings((prev) => (prev ? { ...prev, template_id: templateId, template } : { id: '', scope: 'avatar', template_id: templateId, template } as SettingsRow));
    }
  };

  if (loading) return <Text style={styles.loading}>Yükleniyor...</Text>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Oda QR</Text>
      <View style={styles.templateGrid}>
        {roomTemplates.map((t) => {
          const isSelected = roomSettings?.template_id === t.id;
          const design: QRDesign = {
            useLogo: t.use_logo,
            backgroundColor: t.background_color,
            foregroundColor: t.foreground_color,
            shape: t.shape,
            logoSizeRatio: Number(t.logo_size_ratio) || 0.24,
          };
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.templateCard, isSelected && styles.templateCardSelected]}
              onPress={() => setActiveTemplate('room', t.id)}
            >
              <DesignableQR value={SAMPLE_QR_VALUE} size={qrPreviewSize} design={design} />
              <Text style={styles.templateName} numberOfLines={2}>{t.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.optionsCard}>
        <View style={styles.row}>
          <Text style={styles.label}>Logo</Text>
          <Switch
            value={roomDesign?.useLogo ?? true}
            onValueChange={(v) => setRoomOverride((o) => ({ ...o, use_logo_override: v }))}
          />
        </View>
        <Text style={styles.label}>Arka plan</Text>
        <View style={styles.colorRow}>
          {PRESET_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.colorChip, { backgroundColor: c }, (roomOverride.background_color_override ?? roomDesign?.backgroundColor) === c && styles.colorChipBorder]}
              onPress={() => setRoomOverride((o) => ({ ...o, background_color_override: c }))}
            />
          ))}
        </View>
        <Text style={styles.label}>QR rengi</Text>
        <View style={styles.colorRow}>
          {PRESET_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.colorChip, { backgroundColor: c }, (roomOverride.foreground_color_override ?? roomDesign?.foregroundColor) === c && styles.colorChipBorder]}
              onPress={() => setRoomOverride((o) => ({ ...o, foreground_color_override: c }))}
            />
          ))}
        </View>
        <Text style={styles.label}>Şekil</Text>
        <View style={styles.shapeRow}>
          {(['square', 'rounded', 'circle'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              style={[(roomOverride.shape_override ?? roomDesign?.shape) === s ? styles.shapeBtnActive : styles.shapeBtn]}
              onPress={() => setRoomOverride((o) => ({ ...o, shape_override: s }))}
            >
              <Text style={(roomOverride.shape_override ?? roomDesign?.shape) === s ? styles.shapeBtnTextActive : styles.shapeBtnText}>{SHAPE_LABELS[s]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.saveBtn} onPress={() => saveSettings('room')} disabled={!!saving}>
          <Text style={styles.saveBtnText}>{saving === 'room' ? 'Kaydediliyor...' : 'Kaydet'}</Text>
        </TouchableOpacity>
      </View>
      {roomDesign && (
        <View style={styles.previewWrap}>
          <DesignableQR value={SAMPLE_QR_VALUE} size={120} design={roomDesign} />
        </View>
      )}

      <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Avatar QR</Text>
      <View style={styles.templateGrid}>
        {avatarTemplates.map((t) => {
          const isSelected = avatarSettings?.template_id === t.id;
          const design: QRDesign = {
            useLogo: t.use_logo,
            backgroundColor: t.background_color,
            foregroundColor: t.foreground_color,
            shape: t.shape,
            logoSizeRatio: Number(t.logo_size_ratio) || 0.24,
          };
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.templateCard, isSelected && styles.templateCardSelected]}
              onPress={() => setActiveTemplate('avatar', t.id)}
            >
              <DesignableQR value={SAMPLE_QR_VALUE} size={qrPreviewSize} design={design} />
              <Text style={styles.templateName} numberOfLines={2}>{t.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.optionsCard}>
        <View style={styles.row}>
          <Text style={styles.label}>Logo</Text>
          <Switch
            value={avatarDesign?.useLogo ?? true}
            onValueChange={(v) => setAvatarOverride((o) => ({ ...o, use_logo_override: v }))}
          />
        </View>
        <Text style={styles.label}>Arka plan</Text>
        <View style={styles.colorRow}>
          {PRESET_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.colorChip, { backgroundColor: c }, (avatarOverride.background_color_override ?? avatarDesign?.backgroundColor) === c && styles.colorChipBorder]}
              onPress={() => setAvatarOverride((o) => ({ ...o, background_color_override: c }))}
            />
          ))}
        </View>
        <Text style={styles.label}>QR rengi</Text>
        <View style={styles.colorRow}>
          {PRESET_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.colorChip, { backgroundColor: c }, (avatarOverride.foreground_color_override ?? avatarDesign?.foregroundColor) === c && styles.colorChipBorder]}
              onPress={() => setAvatarOverride((o) => ({ ...o, foreground_color_override: c }))}
            />
          ))}
        </View>
        <Text style={styles.label}>Şekil</Text>
        <View style={styles.shapeRow}>
          {(['square', 'rounded', 'circle'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              style={[(avatarOverride.shape_override ?? avatarDesign?.shape) === s ? styles.shapeBtnActive : styles.shapeBtn]}
              onPress={() => setAvatarOverride((o) => ({ ...o, shape_override: s }))}
            >
              <Text style={(avatarOverride.shape_override ?? avatarDesign?.shape) === s ? styles.shapeBtnTextActive : styles.shapeBtnText}>{SHAPE_LABELS[s]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.saveBtn} onPress={() => saveSettings('avatar')} disabled={!!saving}>
          <Text style={styles.saveBtnText}>{saving === 'avatar' ? 'Kaydediliyor...' : 'Kaydet'}</Text>
        </TouchableOpacity>
      </View>
      {avatarDesign && (
        <View style={styles.previewWrap}>
          <DesignableQR value={SAMPLE_QR_VALUE} size={100} design={avatarDesign} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fafc' },
  content: { padding: 16, paddingBottom: 48 },
  loading: { padding: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a202c', marginBottom: 10 },
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  templateCard: {
    width: '30%',
    minWidth: 90,
    maxWidth: 110,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  templateCardSelected: { borderColor: '#1a365d', backgroundColor: '#EBF8FF' },
  templateName: { fontSize: 11, color: '#2D3748', marginTop: 6, textAlign: 'center' },
  optionsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  label: { fontSize: 13, color: '#4A5568', marginBottom: 6 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  colorChip: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  colorChipBorder: { borderWidth: 2, borderColor: '#1a365d' },
  shapeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  shapeBtn: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#E2E8F0', borderRadius: 8 },
  shapeBtnActive: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#1a365d', borderRadius: 8 },
  shapeBtnText: { fontSize: 13, color: '#4A5568' },
  shapeBtnTextActive: { fontSize: 13, color: '#fff', fontWeight: '600' },
  saveBtn: { backgroundColor: '#1a365d', padding: 14, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '600' },
  previewWrap: { alignItems: 'center', marginTop: 8, marginBottom: 20 },
});
