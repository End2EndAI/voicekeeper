import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { AudioWaveform } from '../components/AudioWaveform';
import { Colors } from '../constants/colors';
import { MAX_RECORDING_DURATION_MS } from '../constants/formats';
import { usePreferences } from '../contexts/PreferencesContext';
import {
  requestMicrophonePermission,
  prepareRecording,
  stopRecording,
} from '../services/recording';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RecordScreen() {
  const router = useRouter();
  const { defaultFormat } = usePreferences();
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [metering, setMetering] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    checkPermission();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      // Cleanup recording if component unmounts while recording
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const checkPermission = async () => {
    const granted = await requestMicrophonePermission();
    setPermissionGranted(granted);
  };

  const startRecording = async () => {
    try {
      setError(null);

      if (!permissionGranted) {
        const granted = await requestMicrophonePermission();
        if (!granted) {
          setError(
            'Microphone permission is required. Please enable it in your device settings.'
          );
          return;
        }
        setPermissionGranted(true);
      }

      const recording = await prepareRecording();
      recordingRef.current = recording;
      setIsRecording(true);
      setDuration(0);

      // Update duration and metering
      intervalRef.current = setInterval(async () => {
        if (recordingRef.current) {
          try {
            const status = await recordingRef.current.getStatusAsync();
            if (status.isRecording) {
              setDuration(status.durationMillis);
              // Normalize metering
              if (status.metering !== undefined) {
                const normalized = Math.max(0, (status.metering + 60) / 60);
                setMetering(Math.min(1, normalized));
              }
              // Auto-stop at max duration
              if (status.durationMillis >= MAX_RECORDING_DURATION_MS) {
                handleStopRecording();
              }
            }
          } catch {
            // Recording may have been stopped
          }
        }
      }, 100);
    } catch (err: any) {
      setError('Failed to start recording. Please try again.');
      console.error('Recording start error:', err);
    }
  };

  const handleStopRecording = useCallback(async () => {
    if (!recordingRef.current) return;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    try {
      const uri = await stopRecording(recordingRef.current);
      recordingRef.current = null;
      setIsRecording(false);
      setMetering(0);

      // Navigate to preview with audio URI
      router.replace({
        pathname: '/preview',
        params: { audioUri: uri, formatType: defaultFormat },
      });
    } catch (err: any) {
      setError('Failed to stop recording. Please try again.');
      setIsRecording(false);
      console.error('Recording stop error:', err);
    }
  }, [defaultFormat, router]);

  const handleCancel = async () => {
    if (recordingRef.current) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {}
      recordingRef.current = null;
    }
    setIsRecording(false);
    router.back();
  };

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const maxDurationFormatted = formatDuration(MAX_RECORDING_DURATION_MS);

  if (permissionGranted === false) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionIcon}>🎙️</Text>
          <Text style={styles.permissionTitle}>Microphone Access Needed</Text>
          <Text style={styles.permissionText}>
            VoiceKeeper needs microphone access to record voice notes. Please
            enable it in your device settings.
          </Text>
          <Pressable style={styles.retryButton} onPress={checkPermission}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
          <Pressable style={styles.cancelButton} onPress={() => router.back()}>
            <Text style={styles.cancelButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={handleCancel} style={styles.cancelButton}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.waveformArea}>
          <AudioWaveform metering={metering} isRecording={isRecording} />
        </View>

        <Text style={styles.duration}>{formatDuration(duration)}</Text>
        <Text style={styles.maxDuration}>Max: {maxDurationFormatted}</Text>

        <View style={styles.controls}>
          {!isRecording ? (
            <Pressable
              style={styles.recordButton}
              onPress={startRecording}
              accessibilityLabel="Start recording"
            >
              <View style={styles.recordDot} />
            </Pressable>
          ) : (
            <Pressable
              style={styles.stopButton}
              onPress={handleStopRecording}
              accessibilityLabel="Stop recording"
            >
              <View style={styles.stopSquare} />
            </Pressable>
          )}
        </View>

        <Text style={styles.hint}>
          {isRecording ? 'Tap to stop recording' : 'Tap to start recording'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    padding: 16,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  errorContainer: {
    backgroundColor: Colors.errorLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    width: '100%',
    maxWidth: 400,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  waveformArea: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 24,
  },
  duration: {
    fontSize: 48,
    fontWeight: '300',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  maxDuration: {
    fontSize: 14,
    color: Colors.textTertiary,
    marginTop: 4,
    marginBottom: 40,
  },
  controls: {
    marginBottom: 16,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'transparent',
    borderWidth: 4,
    borderColor: Colors.recording,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordDot: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.recording,
  },
  stopButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'transparent',
    borderWidth: 4,
    borderColor: Colors.recording,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopSquare: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: Colors.recording,
  },
  hint: {
    fontSize: 14,
    color: Colors.textTertiary,
    marginTop: 12,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 8,
  },
  cancelButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
