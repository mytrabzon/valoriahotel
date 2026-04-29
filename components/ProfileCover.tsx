import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CachedImage } from '@/components/CachedImage';

type ProfileCoverProps = {
  imageUri?: string | null;
  height: number;
  onPress?: () => void;
  disabled?: boolean;
  children?: ReactNode;
};

export function ProfileCover({ imageUri, height, onPress, disabled, children }: ProfileCoverProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.root, { height }]}
      accessibilityRole="imagebutton"
    >
      {imageUri ? (
        <CachedImage uri={imageUri} style={styles.coverImage} contentFit="cover" />
      ) : (
        <LinearGradient
          colors={['#475569', '#334155', '#1f2937']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.coverImage}
        />
      )}
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  coverImage: {
    ...StyleSheet.absoluteFillObject,
  },
});

