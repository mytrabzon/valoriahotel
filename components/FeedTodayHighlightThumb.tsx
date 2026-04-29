import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { CachedImage } from '@/components/CachedImage';
import { theme } from '@/constants/theme';

type Props = {
  /** thumbnail_url veya görsel gönderilerde media_url */
  thumbUri: string | null;
  /** video gönderilerinde media_url */
  videoSourceUrl: string | null;
  isVideo: boolean;
};

/**
 * Bugün şeridi küçük önizleme. Videoda `thumbnail_url` yoksa ana feed ile aynı şekilde
 * duraklatılmış `expo-av` Video ile ilk kareye yakın görüntü (ek paket gerekmez).
 */
export function FeedTodayHighlightThumb({ thumbUri, videoSourceUrl, isVideo }: Props) {
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    setVideoFailed(false);
  }, [videoSourceUrl]);

  if (thumbUri) {
    return <CachedImage uri={thumbUri} style={styles.img} contentFit="cover" transition={120} />;
  }

  if (isVideo && videoSourceUrl && !videoFailed) {
    return (
      <View style={styles.videoShell}>
        <Video
          source={{ uri: videoSourceUrl }}
          style={styles.img}
          resizeMode={ResizeMode.COVER}
          shouldPlay={false}
          isLooping={false}
          isMuted
          useNativeControls={false}
          onError={() => setVideoFailed(true)}
        />
        <View style={styles.playBadge} pointerEvents="none">
          <Ionicons name="play" size={14} color="#fff" />
        </View>
      </View>
    );
  }

  if (isVideo && videoSourceUrl && videoFailed) {
    return (
      <View style={styles.ph}>
        <Ionicons name="videocam" size={22} color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.ph}>
      <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  img: { width: '100%', height: '100%' },
  videoShell: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#0f172a',
  },
  playBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ph: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${theme.colors.primary}14`,
  },
});
