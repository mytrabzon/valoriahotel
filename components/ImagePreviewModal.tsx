import React from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { CachedImage } from '@/components/CachedImage';

type ImagePreviewModalProps = {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
};

/** Tıklanınca büyük resim önizlemesi açan modal. Stok / profil resimleri için kullan. */
export function ImagePreviewModal({ visible, uri, onClose }: ImagePreviewModalProps) {
  const { width, height } = useWindowDimensions();
  if (!uri) return null;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.content, { maxWidth: width, maxHeight: height }]} onPress={(e) => e.stopPropagation()}>
          <CachedImage uri={uri} style={[styles.image, { width, height: height * 0.85 }]} contentFit="contain" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    borderRadius: 0,
  },
});
