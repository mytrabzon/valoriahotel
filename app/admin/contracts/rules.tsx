import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

const LANGUAGES = [
  { code: 'tr', label: 'Türkçe' },
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'ru', label: 'Русский' },
  { code: 'es', label: 'Español' },
];

export default function RulesContractEdit() {
  const router = useRouter();
  const [selectedLang, setSelectedLang] = useState('tr');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('contract_templates')
        .select('title, content')
        .eq('lang', selectedLang)
        .eq('version', 2)
        .maybeSingle();
      setTitle(data?.title ?? '');
      setContent(data?.content ?? '');
      setLoading(false);
    })();
  }, [selectedLang]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('contract_templates')
      .update({ title: title || 'Sözleşme', content: content || '', updated_at: new Date().toISOString() })
      .eq('lang', selectedLang)
      .eq('version', 2);
    setSaving(false);
    if (error) {
      Alert.alert('Hata', error.message);
      return;
    }
    Alert.alert('Kaydedildi', `${LANGUAGES.find((l) => l.code === selectedLang)?.label} sözleşme güncellendi.`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>Dil seçin, başlık ve HTML içeriğini düzenleyin. Resim (img src), link (a href), telefon (tel: / wa.me) kullanabilirsiniz. Karakter sınırı yok.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.langRow} contentContainerStyle={styles.langRowContent}>
        {LANGUAGES.map(({ code, label }) => (
          <TouchableOpacity
            key={code}
            style={[styles.langBtn, selectedLang === code && styles.langBtnActive]}
            onPress={() => setSelectedLang(code)}
          >
            <Text style={[styles.langBtnText, selectedLang === code && styles.langBtnTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <Text style={styles.loading}>Yükleniyor...</Text>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.label}>Başlık</Text>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Örn: Konaklama Sözleşmesi ve Otel Kuralları"
            placeholderTextColor="#94a3b8"
          />
          <Text style={styles.label}>İçerik (HTML – resim/link/numara desteklenir)</Text>
          <TextInput
            style={styles.contentInput}
            value={content}
            onChangeText={setContent}
            placeholder="<div>...</div> veya HTML"
            placeholderTextColor="#94a3b8"
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={save} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fafc' },
  hint: { padding: 12, paddingHorizontal: 16, backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: 12 },
  langRow: { maxHeight: 48 },
  langRowContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: 'center' },
  langBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e2e8f0', marginRight: 8 },
  langBtnActive: { backgroundColor: '#1a365d' },
  langBtnText: { color: '#475569', fontSize: 13 },
  langBtnTextActive: { color: '#fff', fontWeight: '600' },
  loading: { padding: 24 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 48 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 6 },
  titleInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  contentInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 320,
    backgroundColor: '#fff',
    fontFamily: 'monospace',
  },
  saveBtn: { marginTop: 24, backgroundColor: '#1a365d', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
