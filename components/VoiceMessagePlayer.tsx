/**
 * Sesli mesaj oynatıcı - expo-av ile
 */
import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import { MESSAGING_COLORS } from '@/lib/messaging';

type Props = {
  uri: string;
  isOwn: boolean;
  durationSec?: number | null;
};

export function VoiceMessagePlayer({ uri, isOwn, durationSec: propDuration }: Props) {
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [positionSec, setPositionSec] = useState(0);
  const [durationSec, setDurationSec] = useState(propDuration ?? 0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updatePosition = async () => {
    if (!soundRef.current) return;
    const s = await soundRef.current.getStatusAsync();
    if (s.isLoaded && s.positionMillis != null) setPositionSec(Math.floor(s.positionMillis / 1000));
  };

  const togglePlay = async () => {
    if (!uri) return;
    try {
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (!status.isLoaded) return;
        if (status.isPlaying) {
          await soundRef.current.pauseAsync();
          setPlaying(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return;
        }
        await soundRef.current.playAsync();
        setPlaying(true);
        intervalRef.current = setInterval(updatePosition, 400);
        return;
      }
      setLoading(true);
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        (s) => {
          if (s.isLoaded && s.durationMillis != null) setDurationSec(Math.floor(s.durationMillis / 1000));
          if (s.isLoaded && s.didJustFinishAndNotReset) {
            setPlaying(false);
            setPositionSec(0);
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
          }
        }
      );
      soundRef.current = sound;
      setLoading(false);
      setPlaying(true);
      setPositionSec(0);
      const status = await sound.getStatusAsync();
      if (status.isLoaded && status.durationMillis != null) {
        setDurationSec(Math.floor(status.durationMillis / 1000));
      }
      intervalRef.current = setInterval(updatePosition, 400);
    } catch (e) {
      setLoading(false);
      setPlaying(false);
    }
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const displayDuration = durationSec > 0 ? durationSec : Math.max(positionSec, 1);
  const displayPosition = positionSec;

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={[styles.playBtn, isOwn && styles.playBtnOwn]}
        onPress={togglePlay}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color={isOwn ? '#fff' : MESSAGING_COLORS.primary} />
        ) : (
          <Text style={styles.playIcon}>{playing ? '⏹' : '▶'}</Text>
        )}
      </TouchableOpacity>
      <View style={styles.info}>
        <View style={[styles.bar, isOwn && styles.barOwn]}>
          <View
            style={[
              styles.barFill,
              isOwn && styles.barFillOwn,
              { width: `${displayDuration ? (displayPosition / displayDuration) * 100 : 0}%` },
            ]}
          />
        </View>
        <Text style={[styles.time, isOwn && styles.timeOwn]}>
          {displayPosition > 0 ? `${displayPosition}″` : ''} / {displayDuration}″
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 140 },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBtnOwn: { backgroundColor: 'rgba(255,255,255,0.3)' },
  playIcon: { fontSize: 18 },
  info: { flex: 1 },
  bar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  barOwn: { backgroundColor: 'rgba(255,255,255,0.3)' },
  barFill: { height: '100%', backgroundColor: MESSAGING_COLORS.primary, borderRadius: 2 },
  barFillOwn: { backgroundColor: '#fff' },
  time: { fontSize: 11, color: MESSAGING_COLORS.textSecondary, marginTop: 2 },
  timeOwn: { color: 'rgba(255,255,255,0.85)' },
});
