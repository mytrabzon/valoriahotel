/**
 * Sesli mesaj kaydı - expo-av ile
 */
import { useState, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

export type RecordingState = 'idle' | 'recording' | 'stopped' | 'error';

export function useVoiceRecorder() {
  const [state, setState] = useState<RecordingState>('idle');
  const [durationSec, setDurationSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async (): Promise<string | null> => {
    setError(null);
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setState('recording');
      setDurationSec(0);
      const start = Date.now();
      durationIntervalRef.current = setInterval(() => {
        setDurationSec(Math.floor((Date.now() - start) / 1000));
      }, 1000);
      return null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Kayıt başlatılamadı';
      setError(msg);
      setState('error');
      return msg;
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!recordingRef.current || state !== 'recording') return null;
    try {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setState('stopped');
      return uri;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Kayıt durdurulamadı';
      setError(msg);
      setState('error');
      return null;
    }
  }, [state]);

  const cancelRecording = useCallback(async () => {
    if (recordingRef.current && state === 'recording') {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {
        // ignore
      }
      recordingRef.current = null;
    }
    setState('idle');
    setDurationSec(0);
    setError(null);
  }, [state]);

  const reset = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    recordingRef.current = null;
    setState('idle');
    setDurationSec(0);
    setError(null);
  }, []);

  return {
    state,
    durationSec,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
  };
}
