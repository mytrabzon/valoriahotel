import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Share,
  Platform,
  Alert,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { adminTheme } from '@/constants/adminTheme';
import { useAuthStore } from '@/stores/authStore';
import {
  buildCarbonReportCsv,
  buildCarbonReportHtml,
  hotelTotalKgCo2,
  shareCarbonPdf,
  type CarbonReportMonthRow,
} from '@/lib/carbonReportPdf';
import { SCOPE3_SPEND_DISCLAIMER } from '@/lib/carbonConstants';
import { fetchScope3SpendByYear, type Scope3SpendMonthRow } from '@/lib/carbonScope3Spend';

function fmt(n: number, max = 2): string {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: max }).format(n);
}

function monthLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

const YEARS = () => {
  const y = new Date().getFullYear();
  return [y + 1, y, y - 1, y - 2, y - 3];
};

export default function AdminCarbonReportScreen() {
  const { staff } = useAuthStore();
  const [rows, setRows] = useState<CarbonReportMonthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [occupancyByMonth, setOccupancyByMonth] = useState<Record<string, number>>({});
  const [exportingPdf, setExportingPdf] = useState(false);
  const [scope3Rows, setScope3Rows] = useState<Scope3SpendMonthRow[]>([]);
  const [scope3Unavailable, setScope3Unavailable] = useState(false);

  const load = useCallback(async () => {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    const { data, error } = await supabase
      .from('hotel_carbon_monthly_inputs')
      .select(
        'month_start, electricity_kwh, water_m3, gas_m3, waste_kg, electricity_factor, water_factor, gas_factor, waste_factor, methodology_version, methodology_summary, electricity_factor_source, water_factor_source, gas_factor_source, waste_factor_source, data_collection_notes, prepared_by_name, verification_notes'
      )
      .gte('month_start', start)
      .lte('month_start', end)
      .order('month_start', { ascending: false });

    if (error) {
      Alert.alert('Hata', error.message);
      setRows([]);
      setOccupancyByMonth({});
      return;
    }

    const list = (data as CarbonReportMonthRow[]) ?? [];
    setRows(list);

    const occ: Record<string, number> = {};
    await Promise.all(
      list.map(async (r) => {
        const { data: n, error: e2 } = await supabase.rpc('carbon_month_occupancy_nights', {
          p_month_start: r.month_start,
        });
        if (!e2 && n != null) occ[r.month_start] = Number(n);
      })
    );
    setOccupancyByMonth(occ);

    setScope3Unavailable(false);
    try {
      const s3 = await fetchScope3SpendByYear(year);
      setScope3Rows(s3);
    } catch {
      setScope3Rows([]);
      setScope3Unavailable(true);
    }
  }, [year]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const scope3Annual = useMemo(() => {
    return scope3Rows.reduce((s, r) => s + (r.kg_co2e_estimate ?? 0), 0);
  }, [scope3Rows]);

  const summary = useMemo(() => {
    const sorted = [...rows].sort((a, b) => a.month_start.localeCompare(b.month_start));
    const annual = sorted.reduce((s, r) => s + hotelTotalKgCo2(r), 0);
    const totalOcc = sorted.reduce((s, r) => s + (occupancyByMonth[r.month_start] ?? 0), 0);
    const kgPerNight = totalOcc > 0 ? annual / totalOcc : 0;
    const last = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    const thisMonth = last ? hotelTotalKgCo2(last) : 0;
    const prevMonth = prev ? hotelTotalKgCo2(prev) : 0;
    const changePct = prevMonth > 0 ? ((thisMonth - prevMonth) / prevMonth) * 100 : 0;
    return { annual, totalOcc, kgPerNight, changePct, thisMonth, prevMonth, monthCount: sorted.length };
  }, [rows, occupancyByMonth]);

  const exportPdf = useCallback(async () => {
    if (rows.length === 0) {
      Alert.alert('Veri yok', 'Önce seçili yıl için aylık girdi kaydedin.');
      return;
    }
    setExportingPdf(true);
    try {
      const sorted = [...rows].sort((a, b) => a.month_start.localeCompare(b.month_start));
      const prepared =
        sorted.map((r) => r.prepared_by_name?.trim()).find(Boolean) || staff?.full_name?.trim() || '—';
      const html = buildCarbonReportHtml({
        rows: sorted,
        yearLabel: String(year),
        occupancyByMonth,
        generatedAtIso: new Date().toISOString(),
        preparedByName: prepared,
        scope3ByMonth: scope3Unavailable ? null : scope3Rows,
      });
      await shareCarbonPdf(html, `karbon-raporu-${year}.pdf`);
    } catch (e) {
      Alert.alert('PDF', (e as Error)?.message ?? 'Oluşturulamadı');
    } finally {
      setExportingPdf(false);
    }
  }, [rows, year, occupancyByMonth, staff?.full_name, scope3Rows, scope3Unavailable]);

  const exportCsv = useCallback(() => {
    const sorted = [...rows].sort((a, b) => a.month_start.localeCompare(b.month_start));
    const csv = buildCarbonReportCsv({
      rows: sorted,
      occupancyByMonth,
      scope3ByMonth: scope3Unavailable ? null : scope3Rows,
    });
    const name = `karbon-${year}.csv`;
    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      Share.share({ message: csv, title: name }).catch(() => {});
    }
  }, [rows, occupancyByMonth, year, scope3Rows, scope3Unavailable]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={adminTheme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[adminTheme.colors.primary]} />}
    >
      <View style={styles.yearRow}>
        <Text style={styles.yearLabel}>Rapor yılı</Text>
        <View style={styles.yearChips}>
          {YEARS().map((y) => (
            <TouchableOpacity
              key={y}
              style={[styles.yearChip, year === y && styles.yearChipActive]}
              onPress={() => setYear(y)}
              activeOpacity={0.85}
            >
              <Text style={[styles.yearChipText, year === y && styles.yearChipTextActive]}>{y}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Karbon özeti ({year})</Text>
        <Text style={styles.summaryLine}>Yıllık toplam (tesis): {fmt(summary.annual, 1)} kg CO₂</Text>
        <Text style={styles.summaryLine}>Kayıtlı ay sayısı: {summary.monthCount}</Text>
        <Text style={styles.summaryLine}>Toplam konaklama gecesi (hesaplanan): {fmt(summary.totalOcc, 1)}</Text>
        <Text style={styles.summaryLine}>Yoğunluk: {summary.totalOcc > 0 ? fmt(summary.kgPerNight, 3) : '—'} kg CO₂ / gece</Text>
        {rows.length >= 2 && (
          <Text style={styles.summaryLine}>
            Son kayda göre önceki aya değişim: {summary.changePct >= 0 ? '+' : ''}
            {fmt(summary.changePct, 0)}%
          </Text>
        )}
      </View>

      <View style={styles.scope3Card}>
        <Text style={styles.scope3Title}>Scope 3 — harcama bazlı tahmin (ayrı)</Text>
        <Text style={styles.scope3Disclaimer}>{SCOPE3_SPEND_DISCLAIMER}</Text>
        {scope3Unavailable ? (
          <Text style={styles.scope3Muted}>
            Bu özet yüklenemedi. Supabase&apos;de admin_scope3_spend_carbon_by_month RPC yoksa migration 158 dosyasını uygulayın.
          </Text>
        ) : (
          <>
            <Text style={styles.scope3Line}>
              Yıllık tahmini toplam (TRY × çarpan): {fmt(scope3Annual, 2)} kg CO₂e
            </Text>
            <Text style={styles.scope3Muted}>
              Kaynak: onaylı personel harcamaları + onaylı maaş (işletmeniz); tesis elektrik/su/gaz tablosu ile toplanmaz.
            </Text>
            {scope3Rows.filter((r) => (r.total_try ?? 0) > 0).length > 0 ? (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.scope3SubTitle}>Kayıt olan aylar</Text>
                {scope3Rows
                  .filter((r) => (r.total_try ?? 0) > 0)
                  .map((r) => (
                    <Text key={r.month_start} style={styles.scope3MonthLine}>
                      {monthLabel(r.month_start)} · TRY {fmt(r.total_try)} → ~{fmt(r.kg_co2e_estimate, 2)} kg CO₂e
                    </Text>
                  ))}
              </View>
            ) : (
              <Text style={[styles.scope3Muted, { marginTop: 8 }]}>Bu yıl için onaylı harcama/maaş tutarı yok.</Text>
            )}
          </>
        )}
      </View>

      <View style={styles.exportRow}>
        <TouchableOpacity
          style={[styles.exportBtn, exportingPdf && styles.exportBtnDisabled]}
          onPress={exportPdf}
          disabled={exportingPdf}
          activeOpacity={0.85}
        >
          {exportingPdf ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.exportBtnText}>PDF paylaş</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportBtnSecondary} onPress={exportCsv} activeOpacity={0.85}>
          <Text style={styles.exportBtnSecondaryText}>CSV paylaş</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>
        PDF; işletme bilgisi, aylık tüketim, kg CO₂ / gece, metodoloji metni ve her ay için katsayı kaynaklarını içerir. Resmî beyan yerine
        geçmez; denetim ve iç kontrol içindir.
      </Text>

      <Text style={styles.sectionTitle}>Aylık detay</Text>
      {rows.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Bu yıl için henüz karbon girdisi yok.</Text>
        </View>
      ) : (
        rows.map((r) => {
          const total = hotelTotalKgCo2(r);
          const occ = occupancyByMonth[r.month_start] ?? 0;
          const perNight = occ > 0 ? total / occ : 0;
          return (
            <View key={r.month_start} style={styles.rowCard}>
              <Text style={styles.rowMonth}>{monthLabel(r.month_start)}</Text>
              <Text style={styles.rowTotal}>{fmt(total, 1)} kg CO₂ (tesis)</Text>
              <Text style={styles.rowDetail}>
                E:{fmt(r.electricity_kwh)} kWh · S:{fmt(r.water_m3)} m³ · G:{fmt(r.gas_m3)} m³ · A:{fmt(r.waste_kg)} kg
              </Text>
              <Text style={styles.rowDetail}>
                Konaklama gecesi: {fmt(occ, 1)} · kg CO₂/gece: {occ > 0 ? fmt(perNight, 3) : '—'}
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: adminTheme.colors.surfaceSecondary },
  content: { padding: 16, paddingBottom: 28 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: adminTheme.colors.surfaceSecondary },
  yearRow: { marginBottom: 12 },
  yearLabel: { color: adminTheme.colors.textSecondary, fontSize: 13, marginBottom: 8 },
  yearChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  yearChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
    backgroundColor: adminTheme.colors.surface,
  },
  yearChipActive: { backgroundColor: adminTheme.colors.primary, borderColor: adminTheme.colors.primary },
  yearChipText: { color: adminTheme.colors.text, fontWeight: '600', fontSize: 14 },
  yearChipTextActive: { color: '#fff' },
  summaryCard: {
    backgroundColor: adminTheme.colors.surface,
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
    borderRadius: 12,
    padding: 14,
  },
  summaryTitle: { color: adminTheme.colors.text, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  summaryLine: { color: adminTheme.colors.textSecondary, fontSize: 14, marginBottom: 5 },
  scope3Card: {
    marginTop: 12,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 12,
    padding: 14,
  },
  scope3Title: { color: '#92400e', fontSize: 15, fontWeight: '800', marginBottom: 8 },
  scope3Disclaimer: { color: '#78350f', fontSize: 11, lineHeight: 16, marginBottom: 8 },
  scope3Line: { color: adminTheme.colors.text, fontSize: 14, fontWeight: '600' },
  scope3Muted: { color: adminTheme.colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 6 },
  scope3SubTitle: { color: '#92400e', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  scope3MonthLine: { color: adminTheme.colors.textSecondary, fontSize: 12, marginBottom: 4 },
  exportRow: { flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 8 },
  exportBtn: {
    flex: 1,
    backgroundColor: adminTheme.colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportBtnDisabled: { opacity: 0.75 },
  exportBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  exportBtnSecondary: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
    backgroundColor: adminTheme.colors.surface,
  },
  exportBtnSecondaryText: { color: adminTheme.colors.primary, fontWeight: '800', fontSize: 15 },
  hint: { color: adminTheme.colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 8 },
  sectionTitle: { marginTop: 14, marginBottom: 8, color: adminTheme.colors.text, fontSize: 15, fontWeight: '700' },
  emptyCard: {
    backgroundColor: adminTheme.colors.surface,
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
    borderRadius: 12,
    padding: 14,
  },
  emptyText: { color: adminTheme.colors.textSecondary, fontSize: 14 },
  rowCard: {
    backgroundColor: adminTheme.colors.surface,
    borderWidth: 1,
    borderColor: adminTheme.colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  rowMonth: { color: adminTheme.colors.text, fontSize: 15, fontWeight: '700' },
  rowTotal: { marginTop: 4, color: adminTheme.colors.primary, fontSize: 18, fontWeight: '800' },
  rowDetail: { marginTop: 4, color: adminTheme.colors.textMuted, fontSize: 12 },
});
