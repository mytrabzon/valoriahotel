import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  AppState,
  ActivityIndicator,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { Camera, CameraView } from 'expo-camera';
import { parseMrzToNormalized } from '@/lib/scanner/mrzParser';
import type { ParsedDocument } from '@/lib/scanner/types';
import { formatIsoDateTr } from '@/lib/scanner/mrzDates';
import { formatIcao3ForTr } from '@/lib/scanner/mrzIssuingLabel';
import { extractMrzFromLines } from '@/lib/scanner/mrzExtractLines';
import { ocrLinesLookLikeMrz } from '@/lib/scanner/mrzPresence';
import { MRZ_OCR_ENGINE_EXPO, ocrLinesFromImage } from '@/lib/scanner/ocrLinesFromImage';
import { canSaveMrzDocument } from '@/lib/scanner/mrzScanGate';
import {
  MRZ_FRAME_BORDER,
  MRZ_FRAME_PILL_BG,
  frameKindFromGate,
  type MrzCameraFrameKind,
} from '@/lib/scanner/mrzFrameTheme';
import { apiPost } from '@/lib/kbsApi';
import { upsertGuestDocumentLocal } from '@/lib/kbsDocumentUpsertLocal';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { canStaffUseMrzScan } from '@/lib/kbsMrzAccess';

type UpsertData = { guestId: string; guestDocumentId: string; scanStatus: string };

/**
 * Expo: video frame yok. Bekçi modu: seyrek kare + hafif MRZ sinyali;
 * kilit modu: MRZ sinyali sonrası daha sık tam pipeline.
 */
const MRZ_SCOUT_MS = Platform.OS === 'android' ? 1400 : 1200;
const MRZ_LOCK_MS = Platform.OS === 'android' ? 400 : 320;
const MRZ_LOCK_EXIT_EMPTY_STREAK = 5;
const MRZ_STREAK_OK = 2;

export default function KbsScanScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  type PermStatus = 'granted' | 'denied' | 'undetermined';
  const [permStatus, setPermStatus] = useState<PermStatus | null>(null);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [requesting, setRequesting] = useState(false);

  const cameraRef = useRef<CameraView | null>(null);
  const [cameraMounted, setCameraMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stepLabel, setStepLabel] = useState<string | null>(null);
  const [frameKind, setFrameKind] = useState<MrzCameraFrameKind>('hunting');
  const [pauseAuto, setPauseAuto] = useState(false);
  const [mrzLockOn, setMrzLockOn] = useState(false);

  const inFlightRef = useRef(false);
  const mrzLockOnRef = useRef(false);
  const lockEmptyStreakRef = useRef(0);
  const busyRef = useRef(false);
  const pendingSaveRef = useRef<{
    parsed: ParsedDocument;
    mrzLine: string;
  } | null>(null);
  const pauseAutoRef = useRef(false);
  const streakRef = useRef(0);
  const lastCandMrzRef = useRef<string | null>(null);
  const ocrErrAlertRef = useRef(false);
  const camErrAlertRef = useRef(false);

  const [lastMrz, setLastMrz] = useState<string | null>(null);
  const [lastParsed, setLastParsed] = useState<ParsedDocument | null>(null);
  const [lastOcrPreview, setLastOcrPreview] = useState<string | null>(null);
  const [lastScanUri, setLastScanUri] = useState<string | null>(null);
  const [upsertResult, setUpsertResult] = useState<UpsertData | null>(null);
  const [pendingSave, setPendingSave] = useState<{
    parsed: ParsedDocument;
    mrzLine: string;
  } | null>(null);
  const lastCommittedMrzRef = useRef<string | null>(null);

  const staff = useAuthStore((s) => s.staff);
  const allowedMrz = canStaffUseMrzScan(staff);
  useEffect(() => {
    if (!staff) return;
    if (!canStaffUseMrzScan(staff)) {
      router.replace('/staff' as never);
    }
  }, [staff, router]);

  const refreshPermission = useCallback(async () => {
    try {
      const p = await Camera.getCameraPermissionsAsync();
      setPermStatus(p.status as PermStatus);
      setCanAskAgain(p.canAskAgain ?? true);
    } catch {
      setPermStatus('undetermined');
      setCanAskAgain(true);
    }
  }, []);

  useEffect(() => {
    refreshPermission();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshPermission();
    });
    return () => sub.remove();
  }, [refreshPermission]);

  useEffect(() => {
    if (permStatus !== 'granted') {
      setCameraMounted(false);
      return;
    }
    const delay = Platform.OS === 'android' ? 680 : 160;
    const mountTimer = setTimeout(() => setCameraMounted(true), delay);
    return () => clearTimeout(mountTimer);
  }, [permStatus]);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);
  useEffect(() => {
    pendingSaveRef.current = pendingSave;
  }, [pendingSave]);
  useEffect(() => {
    pauseAutoRef.current = pauseAuto;
  }, [pauseAuto]);
  useEffect(() => {
    mrzLockOnRef.current = mrzLockOn;
  }, [mrzLockOn]);

  useEffect(() => {
    if (
      frameKind === 'idle' ||
      frameKind === 'hunting' ||
      frameKind === 'reading' ||
      frameKind === 'ready_save'
    )
      return;
    const ms = frameKind === 'success' ? 2600 : 3200;
    const id = setTimeout(() => {
      setMrzLockOn(false);
      setFrameKind(pauseAutoRef.current ? 'idle' : 'hunting');
    }, ms);
    return () => clearTimeout(id);
  }, [frameKind]);

  const handleRequestPermission = useCallback(async () => {
    setRequesting(true);
    try {
      const result = await Camera.requestCameraPermissionsAsync();
      setPermStatus(result.status as PermStatus);
      setCanAskAgain(result.canAskAgain ?? true);
    } catch {
      setPermStatus('undetermined');
    } finally {
      setRequesting(false);
    }
  }, []);

  const processScoutFrame = useCallback(async () => {
    if (inFlightRef.current) return;
    if (!cameraMounted) return;
    if (pauseAutoRef.current) return;
    if (pendingSaveRef.current) return;
    if (busyRef.current) return;
    if (mrzLockOnRef.current) return;

    inFlightRef.current = true;
    try {
      const camAny = cameraRef.current as any;
      if (!camAny?.takePictureAsync) {
        if (!camErrAlertRef.current) {
          camErrAlertRef.current = true;
          Alert.alert(t('kbsCameraAlertTitle'), t('kbsPhotoModeUnavailable'));
        }
        setPauseAuto(true);
        setMrzLockOn(false);
        setFrameKind('idle');
        return;
      }

      const photo = await camAny.takePictureAsync({ quality: 0.5, skipProcessing: true });
      const uri = photo?.uri as string | undefined;
      if (!uri) return;

      const { lines } = await ocrLinesFromImage(uri);
      if (ocrLinesLookLikeMrz(lines)) {
        setLastOcrPreview(`MRZ+ | ${lines.slice(0, 8).join(' | ') || '—'}`);
        lockEmptyStreakRef.current = 0;
        streakRef.current = 0;
        lastCandMrzRef.current = null;
        setFrameKind('hunting');
        setMrzLockOn(true);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'OCR_NOT_SUPPORTED' || msg.includes('OCR_NOT_SUPPORTED')) {
        if (!ocrErrAlertRef.current) {
          ocrErrAlertRef.current = true;
          setPauseAuto(true);
          setMrzLockOn(false);
          Alert.alert(t('scanErrorTitle'), t('ocrNotSupportedOnDevice'));
        }
        setFrameKind('idle');
        return;
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [cameraMounted, t]);

  const processLockFrame = useCallback(async () => {
    if (inFlightRef.current) return;
    if (!cameraMounted) return;
    if (pauseAutoRef.current) return;
    if (pendingSaveRef.current) return;
    if (busyRef.current) return;
    if (!mrzLockOnRef.current) return;

    inFlightRef.current = true;
    setFrameKind('reading');
    setStepLabel(t('kbsMrzFrameAutoProcessing'));

    const exitLockIfEmpty = () => {
      lockEmptyStreakRef.current += 1;
      if (lockEmptyStreakRef.current < MRZ_LOCK_EXIT_EMPTY_STREAK) {
        setFrameKind('hunting');
        return;
      }
      lockEmptyStreakRef.current = 0;
      streakRef.current = 0;
      lastCandMrzRef.current = null;
      setMrzLockOn(false);
      setFrameKind('hunting');
    };

    try {
      const camAny = cameraRef.current as any;
      if (!camAny?.takePictureAsync) {
        if (!camErrAlertRef.current) {
          camErrAlertRef.current = true;
          Alert.alert(t('kbsCameraAlertTitle'), t('kbsPhotoModeUnavailable'));
        }
        setPauseAuto(true);
        setMrzLockOn(false);
        setFrameKind('idle');
        return;
      }

      const photo = await camAny.takePictureAsync({ quality: 0.72, skipProcessing: true });
      const uri = photo?.uri as string | undefined;
      if (!uri) {
        exitLockIfEmpty();
        return;
      }
      setLastScanUri(uri);

      const { lines } = await ocrLinesFromImage(uri);
      setLastOcrPreview(`Expo OCR | ${lines.slice(0, 10).join(' | ') || '—'}`);

      const mrz = extractMrzFromLines(lines);
      if (!mrz) {
        streakRef.current = 0;
        lastCandMrzRef.current = null;
        exitLockIfEmpty();
        return;
      }

      lockEmptyStreakRef.current = 0;

      if (mrz === lastCommittedMrzRef.current) {
        setFrameKind('hunting');
        return;
      }

      const parsed = parseMrzToNormalized(mrz);
      setLastMrz(mrz);
      setLastParsed(parsed);

      const gate = canSaveMrzDocument({ rawMrz: mrz, parsed });
      if (!gate.allowed) {
        streakRef.current = 0;
        lastCandMrzRef.current = null;
        setFrameKind(frameKindFromGate(gate.reason));
        return;
      }

      if (lastCandMrzRef.current === mrz) {
        streakRef.current += 1;
      } else {
        lastCandMrzRef.current = mrz;
        streakRef.current = 1;
      }

      if (streakRef.current < MRZ_STREAK_OK) {
        setFrameKind('hunting');
        return;
      }

      streakRef.current = 0;
      lastCandMrzRef.current = null;
      setUpsertResult(null);
      setPendingSave({ parsed, mrzLine: mrz });
      setFrameKind('ready_save');
    } catch (e) {
      streakRef.current = 0;
      lastCandMrzRef.current = null;
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'OCR_NOT_SUPPORTED' || msg.includes('OCR_NOT_SUPPORTED')) {
        if (!ocrErrAlertRef.current) {
          ocrErrAlertRef.current = true;
          setPauseAuto(true);
          setMrzLockOn(false);
          Alert.alert(t('scanErrorTitle'), t('ocrNotSupportedOnDevice'));
        }
        setFrameKind('idle');
        return;
      }
      setFrameKind('suspect_ocr');
    } finally {
      inFlightRef.current = false;
      setStepLabel(null);
    }
  }, [cameraMounted, t]);

  useEffect(() => {
    if (!cameraMounted) return;
    if (pendingSave) return;
    if (pauseAuto) return;
    if (mrzLockOn) return;
    const id = setInterval(() => {
      void processScoutFrame();
    }, MRZ_SCOUT_MS);
    return () => clearInterval(id);
  }, [cameraMounted, pendingSave, pauseAuto, mrzLockOn, processScoutFrame]);

  useEffect(() => {
    if (!cameraMounted) return;
    if (pendingSave) return;
    if (pauseAuto) return;
    if (!mrzLockOn) return;
    const id = setInterval(() => {
      void processLockFrame();
    }, MRZ_LOCK_MS);
    const t0 = setTimeout(() => {
      void processLockFrame();
    }, 100);
    return () => {
      clearInterval(id);
      clearTimeout(t0);
    };
  }, [cameraMounted, pendingSave, pauseAuto, mrzLockOn, processLockFrame]);

  const savePendingToServer = useCallback(async (): Promise<boolean> => {
    if (!pendingSave) return false;
    setBusy(true);
    setFrameKind('reading');
    setStepLabel('4/4 Kaydediliyor…');
    try {
      const { parsed } = pendingSave;
      const local = await upsertGuestDocumentLocal({
        parsed,
        scanConfidence: parsed.confidence,
        rawMrz: parsed.rawMrz,
        arrivalGroupId: null,
        ocrEngine: MRZ_OCR_ENGINE_EXPO
      });
      if (local.ok) {
        lastCommittedMrzRef.current = pendingSave.mrzLine;
        setPendingSave(null);
        setMrzLockOn(false);
        setUpsertResult(local.data);
        setFrameKind('success');
        return true;
      }
      const res = await apiPost<UpsertData>('/documents/upsert', {
        arrivalGroupId: null,
        parsed,
        scanConfidence: parsed.confidence,
        rawMrz: parsed.rawMrz,
        ocrEngine: MRZ_OCR_ENGINE_EXPO
      });
      if (!res.ok) {
        const vps = res.error.message ?? '';
        if (/checksum|MRZ|parse|OCR|bad request/i.test(vps)) {
          setFrameKind('checksum_bad');
        } else {
          setFrameKind('ready_save');
        }
        Alert.alert(
          t('error'),
          t('kbsSaveErrorWithVps', { localMessage: local.message, vpsMessage: vps })
        );
        return false;
      }
      lastCommittedMrzRef.current = pendingSave.mrzLine;
      setPendingSave(null);
      setMrzLockOn(false);
      setUpsertResult(res.data);
      setFrameKind('success');
      return true;
    } catch (e) {
      setFrameKind('ready_save');
      const msg = e instanceof Error ? e.message : t('unknownError');
      Alert.alert(t('scanErrorTitle'), msg);
      return false;
    } finally {
      setStepLabel(null);
      setBusy(false);
    }
  }, [pendingSave, t]);

  const framePillText = useMemo(() => {
    if (
      pauseAuto &&
      !pendingSave &&
      frameKind !== 'reading' &&
      frameKind !== 'ready_save' &&
      frameKind !== 'success'
    ) {
      return t('kbsMrzAutoPaused');
    }
    if (frameKind === 'reading') {
      return stepLabel || t('kbsMrzFrameAutoProcessing');
    }
    if (frameKind === 'ready_save') {
      return t('kbsMrzFrameReadySave');
    }
    if (frameKind === 'hunting') {
      return mrzLockOn ? t('kbsMrzFrameLockActive') : t('kbsMrzFrameScout');
    }
    switch (frameKind) {
      case 'idle':
        return t('kbsMrzFrameAlign');
      case 'ready_save':
        return t('kbsMrzFrameReadySave');
      case 'no_mrz':
        return t('kbsMrzFrameNoMrz');
      case 'suspect_ocr':
        return t('kbsMrzFrameUnsharp');
      case 'checksum_bad':
        return t('kbsMrzFrameChecksumBad');
      case 'success':
        return t('kbsMrzFrameSuccess');
      default:
        return t('kbsMrzFrameScout');
    }
  }, [frameKind, stepLabel, t, pauseAuto, pendingSave, mrzLockOn]);

  const fmt = (v: string | null | undefined) => (v != null && String(v).length > 0 ? String(v) : '—');

  const docTypeTr = (code: string | null | undefined) => {
    const m: Record<string, string> = {
      passport: 'Pasaport',
      id_card: 'Kimlik kartı',
      residence_permit: 'İkamet izni',
      other: 'Diğer',
    };
    return code && m[code] ? m[code] : fmt(code);
  };

  const genderTr = (g: ParsedDocument['gender']) => {
    if (g === 'M') return 'Erkek (M)';
    if (g === 'F') return 'Kadın (F)';
    if (g === 'X') return 'Belirtilmedi (X)';
    return '—';
  };

  if (!allowedMrz) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>Bu işlem için yetkiniz yok.</Text>
      </View>
    );
  }

  if (permStatus === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={styles.message}>Kamera izni kontrol ediliyor...</Text>
      </View>
    );
  }

  if (permStatus !== 'granted') {
    return (
      <View style={styles.centered}>
        <View style={styles.permCard}>
          <Text style={styles.permTitle}>MRZ Tarama</Text>
          <Text style={styles.permSub}>Pasaport/ID MRZ okumak için kamera izni gerekiyor.</Text>
          <TouchableOpacity
            style={[styles.permBtn, requesting && { opacity: 0.75 }]}
            onPress={canAskAgain ? handleRequestPermission : () => Camera.requestCameraPermissionsAsync()}
            disabled={requesting}
            activeOpacity={0.85}
          >
            {requesting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.permBtnText}>{canAskAgain ? 'Devam' : 'Ayarları aç'}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
      <View style={styles.topBar}>
        <Text style={styles.title}>MRZ Tarama</Text>
        <Text style={styles.subtitle}>{t('kbsScanTopHint')}</Text>
      </View>

      {!cameraMounted ? (
        <View style={styles.centered}>
          <Text style={styles.message}>Kamera hazırlanıyor...</Text>
        </View>
      ) : (
        <View style={styles.cameraWrap}>
          <CameraView
            ref={(r) => {
              cameraRef.current = r;
            }}
            style={StyleSheet.absoluteFillObject}
            facing="back"
          />
          <View style={styles.overlay} pointerEvents="box-none">
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor:
                    pauseAuto && !pendingSave
                      ? MRZ_FRAME_PILL_BG.idle
                      : MRZ_FRAME_PILL_BG[frameKind],
                },
              ]}
              accessibilityRole="text"
              accessibilityLabel={framePillText}
            >
              {frameKind === 'reading' ? (
                <ActivityIndicator size="small" color="#fff" style={styles.pillSpinner} />
              ) : null}
              <Text style={styles.statusPillText} numberOfLines={3}>
                {framePillText}
              </Text>
            </View>
            <View style={styles.frameRow} pointerEvents="none">
              <View
                style={[
                  styles.mrzFrame,
                  {
                    borderColor: MRZ_FRAME_BORDER[frameKind],
                    borderWidth:
                      frameKind === 'success' || frameKind === 'reading' || frameKind === 'ready_save'
                        ? 3.5
                        : 3,
                  },
                ]}
              />
            </View>
            <Text style={styles.hint}>{t('kbsScanFrameHint')}</Text>
            <View style={styles.controls}>
              {pendingSave ? (
                <View style={styles.saveRow}>
                  <TouchableOpacity
                    style={[styles.btnSave, busy && { opacity: 0.7 }]}
                    onPress={() => void savePendingToServer()}
                    activeOpacity={0.9}
                    disabled={busy}
                  >
                    <Ionicons name="save-outline" size={20} color="#fff" />
                    <Text style={styles.btnSaveText}>{t('kbsMrzSaveButton')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnDiscard}
                    onPress={() => {
                      streakRef.current = 0;
                      lastCandMrzRef.current = null;
                      setMrzLockOn(false);
                      setPendingSave(null);
                      setFrameKind(pauseAuto ? 'idle' : 'hunting');
                    }}
                    activeOpacity={0.9}
                    disabled={busy}
                  >
                    <Text style={styles.btnDiscardText}>{t('kbsMrzDiscardSave')}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {!pendingSave ? (
                <TouchableOpacity
                  style={styles.btnPause}
                  onPress={() => {
                    setPauseAuto((p) => {
                      if (!p) {
                        setMrzLockOn(false);
                        setFrameKind('idle');
                        return true;
                      }
                      setFrameKind('hunting');
                      return false;
                    });
                  }}
                  activeOpacity={0.9}
                >
                  <Ionicons
                    name={pauseAuto ? 'play-circle-outline' : 'pause-circle-outline'}
                    size={20}
                    color={theme.colors.text}
                  />
                  <Text style={styles.btnPauseText}>
                    {pauseAuto ? t('kbsMrzAutoResume') : t('kbsMrzAutoPause')}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      )}

      <View style={styles.resultPanel}>
        <Text style={styles.cardTitle}>Okuma özeti</Text>
        <Text style={styles.help}>
          MRZ yalnızca metin şerididir; yüz fotoğrafı MRZ içinde değil, sayfanın üstündedir. Aşağıda çektiğiniz tam sayfa ve çözülen alanlar
          görünür.
        </Text>

        {lastScanUri ? (
          <View style={styles.previewBlock}>
            <Text style={styles.previewLabel}>Çekilen görüntü (sayfa + MRZ)</Text>
            <Image source={{ uri: lastScanUri }} style={styles.previewImage} resizeMode="contain" />
          </View>
        ) : (
          <Text style={styles.muted}>Henüz tarama görüntüsü yok.</Text>
        )}

        {lastParsed ? (
          <View style={styles.fieldsTable}>
            <Row label="Belge türü" value={docTypeTr(lastParsed.documentType)} />
            <Row label="Ad soyad" value={fmt(lastParsed.fullName)} />
            <Row label="Belge no" value={fmt(lastParsed.documentNumber)} />
            <Row label="Uyruk (ICAO)" value={fmt(lastParsed.nationalityCode)} />
            <Row label="Veren ülke (ICAO)" value={formatIcao3ForTr(lastParsed.issuingCountryCode)} />
            <Row label="Doğum tarihi" value={formatIsoDateTr(lastParsed.birthDate)} />
            <Row label="Son geçerlilik" value={formatIsoDateTr(lastParsed.expiryDate)} />
            <Row label="Cinsiyet" value={genderTr(lastParsed.gender)} />
            <Row
              label="MRZ checksum"
              value={lastParsed.checksumsValid == null ? '—' : lastParsed.checksumsValid ? 'Geçerli' : 'Hatalı / şüpheli'}
            />
            {lastParsed.warnings?.length ? (
              <Text style={styles.warn}>Uyarı: {lastParsed.warnings.join('; ')}</Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.muted}>
            {lastOcrPreview
              ? `Ham OCR (özet): ${lastOcrPreview}`
              : t('kbsScanOcrEmptyHint')}
          </Text>
        )}

        {lastMrz ? (
          <View style={styles.mrzBox}>
            <Text style={styles.mrzTitle}>Ham MRZ metni</Text>
            <Text style={styles.monoSmall}>{String(lastMrz)}</Text>
          </View>
        ) : null}

        {upsertResult ? (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.successTitle}>Kayıt oluşturuldu</Text>
              <Text style={styles.monoSmall}>Durum: {upsertResult.scanStatus}</Text>
              <Text style={styles.monoSmall}>Belge kaydı ID: {upsertResult.guestDocumentId}</Text>
              <Text style={styles.mutedSmall}>Resmi KBS bildirimi için önce oda atayın, ardından bildirim gönderin.</Text>
            </View>
          </View>
        ) : lastParsed && !busy ? (
          <Text style={styles.mutedSmall}>Kayıt bilgisi yoksa yukarıdaki adımlarda hata oluşmuştur.</Text>
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => router.push('/staff/kbs/ready')}
            activeOpacity={0.9}
          >
            <Ionicons name="paper-plane-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.btnSecondaryText}>Bildirime hazır → oda ata / bildir</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnOutline} onPress={() => router.push('/staff/kbs')} activeOpacity={0.9}>
            <Ionicons name="home-outline" size={18} color={theme.colors.textSecondary} />
            <Text style={styles.btnOutlineText}>KBS menü</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.k}>{label}</Text>
      <Text style={rowStyles.v}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.borderLight },
  k: { color: theme.colors.textSecondary, fontWeight: '700', flex: 0.42 },
  v: { color: theme.colors.text, fontWeight: '600', flex: 0.58, textAlign: 'right' },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.backgroundSecondary },
  screenContent: { paddingBottom: 32 },
  topBar: { padding: 16, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  subtitle: { marginTop: 6, fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 },
  cameraWrap: { height: 400, marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFillObject, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, flexDirection: 'column' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    maxWidth: '96%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  pillSpinner: { marginRight: 0 },
  statusPillText: { color: '#fff', fontWeight: '800', fontSize: 13, lineHeight: 18, flexWrap: 'wrap' },
  frameRow: { flex: 1, minHeight: 120, justifyContent: 'center', alignItems: 'center' },
  mrzFrame: {
    width: '92%',
    height: 160,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  hint: { marginTop: 8, marginBottom: 2, color: 'rgba(255,255,255,0.95)', textAlign: 'center', fontWeight: '700', fontSize: 12, lineHeight: 17, paddingHorizontal: 6 },
  controls: { flexDirection: 'column', alignItems: 'stretch', justifyContent: 'center', marginTop: 8, gap: 10, width: '100%' },
  saveRow: { gap: 8, width: '100%' },
  btnSave: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#16a34a',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  btnSaveText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  btnDiscard: { alignItems: 'center', paddingVertical: 8 },
  btnDiscardText: { color: 'rgba(255,255,255,0.95)', fontWeight: '800', fontSize: 14, textDecorationLine: 'underline' },
  btnPause: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 14,
  },
  btnPauseText: { color: theme.colors.text, fontWeight: '800', fontSize: 15 },
  resultPanel: { margin: 16, marginTop: 12, backgroundColor: theme.colors.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.borderLight, padding: 14, gap: 10 },
  cardTitle: { fontWeight: '800', color: theme.colors.text, fontSize: 17 },
  help: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19 },
  previewBlock: { gap: 8 },
  previewLabel: { fontWeight: '800', color: theme.colors.text, fontSize: 13 },
  previewImage: { width: '100%', height: 200, backgroundColor: theme.colors.background, borderRadius: 12 },
  fieldsTable: { marginTop: 4 },
  mrzBox: { marginTop: 8, padding: 10, backgroundColor: theme.colors.background, borderRadius: 10 },
  mrzTitle: { fontWeight: '800', color: theme.colors.textSecondary, marginBottom: 6, fontSize: 12 },
  successBox: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  successTitle: { fontWeight: '900', color: theme.colors.text, marginBottom: 4 },
  warn: { color: '#b45309', fontWeight: '700', marginTop: 8, fontSize: 13 },
  muted: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19 },
  mutedSmall: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  monoSmall: { fontFamily: 'monospace', color: theme.colors.text, fontSize: 11, lineHeight: 16 },
  actions: { gap: 10, marginTop: 8 },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.colors.background,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  btnSecondaryText: { color: theme.colors.primary, fontWeight: '900', fontSize: 15 },
  btnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  btnOutlineText: { color: theme.colors.textSecondary, fontWeight: '800', fontSize: 15 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, minHeight: 120, backgroundColor: theme.colors.backgroundSecondary },
  message: { color: theme.colors.textSecondary, marginTop: 12 },
  permCard: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.colors.borderLight, width: '100%', maxWidth: 360 },
  permTitle: { fontSize: 18, fontWeight: '900', color: theme.colors.text, marginBottom: 6 },
  permSub: { color: theme.colors.textSecondary, lineHeight: 20, marginBottom: 12 },
  permBtn: { backgroundColor: theme.colors.primary, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  permBtnText: { color: '#fff', fontWeight: '900' },
});
