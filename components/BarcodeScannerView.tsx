import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

/** Sadece sık kullanılan barkod tipleri — hepsini taramak kasılmaya yol açar */
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] as const;

export type BarcodeScanResult = { type: string; data: string };

type BarcodeScannerViewProps = {
  onScan: (result: BarcodeScanResult) => void;
  onClose?: () => void;
  continuous?: boolean;
  showCloseButton?: boolean;
  title?: string;
  hint?: string;
};

const SCAN_THROTTLE_MS = 2200;

export function BarcodeScannerView({
  onScan,
  onClose,
  continuous = false,
  showCloseButton = true,
  title = 'Barkod Okut',
  hint = 'Barkodu çerçeve içine getirin',
}: BarcodeScannerViewProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [lastData, setLastData] = useState<string | null>(null);
  const [cameraMounted, setCameraMounted] = useState(false);
  const lastScanTime = useRef(0);

  useEffect(() => {
    let cancelled = false;
    if (!permission) return;
    if (permission.granted) {
      const delay = Platform.OS === 'android' ? 400 : 150;
      const t = setTimeout(() => {
        if (!cancelled) setCameraMounted(true);
      }, delay);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }
    setCameraMounted(false);
    return () => { cancelled = true; };
  }, [permission?.granted]);

  useEffect(() => {
    if (permission?.granted) return;
    requestPermission();
  }, []);

  const handleBarCodeScanned = useCallback(
    ({ type, data }: BarcodeScanResult) => {
      const now = Date.now();
      if (now - lastScanTime.current < SCAN_THROTTLE_MS) return;
      if (!continuous && scanned) return;
      if (continuous && lastData === data) return;
      lastScanTime.current = now;
      setLastData(data);
      if (!continuous) setScanned(true);
      onScan({ type, data });
    },
    [continuous, scanned, lastData, onScan]
  );

  const resetScan = () => {
    setScanned(false);
    setLastData(null);
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>Kamera izni kontrol ediliyor...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>Barkod okutmak için kamera izni gerekiyor.</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Kamera İzni Ver</Text>
        </TouchableOpacity>
        {showCloseButton && onClose && (
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Kapat</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (!cameraMounted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>Kamera hazırlanıyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: [...BARCODE_TYPES],
        }}
        onBarcodeScanned={scanned && !continuous ? undefined : handleBarCodeScanned}
      />
      <View style={styles.overlay}>
        <Text style={styles.overlayTitle}>{title}</Text>
        <View style={styles.frame}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
        <Text style={styles.hint}>{hint}</Text>
        {scanned && !continuous && (
          <TouchableOpacity style={styles.retryBtn} onPress={resetScan}>
            <Text style={styles.retryBtnText}>Tekrar Okut</Text>
          </TouchableOpacity>
        )}
        {showCloseButton && onClose && (
          <TouchableOpacity style={styles.closeBtnOverlay} onPress={onClose}>
            <Text style={styles.closeBtnText}>Kapat</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a365d',
    padding: 24,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginBottom: 24 },
  message: { fontSize: 16, color: '#fff' },
  button: {
    backgroundColor: '#b8860b',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  closeBtn: { marginTop: 16 },
  closeBtnText: { color: 'rgba(255,255,255,0.9)', fontSize: 16 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTitle: {
    position: 'absolute',
    top: 50,
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  frame: {
    width: 260,
    height: 140,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#b8860b',
    borderWidth: 4,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  hint: {
    marginTop: 24,
    fontSize: 14,
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  retryBtn: {
    marginTop: 20,
    backgroundColor: 'rgba(184,134,11,0.9)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  closeBtnOverlay: {
    position: 'absolute',
    bottom: 40,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
});
