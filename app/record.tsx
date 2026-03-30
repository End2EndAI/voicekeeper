import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { AudioWaveform } from '../components/AudioWaveform';
import { Colors } from '../constants/colors';
import { MAX_RECORDING_DURATION_MS } from '../constants/formats';
import { usePreferences } from '../contexts/PreferencesContext';
import { useRecordings } from '../contexts/RecordingsContext';
import { showAlert } from '../utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

export default function RecordScreen() {
  const router = useRouter();
  const { defaultFormat, customExample, customInstructions, isAdmin, tier } = usePreferences();
  const isUnlimited = isAdmin || tier === 'unlimited';
  const { saveRecording } = useRecordings();
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorder = useAudioRecorder(
    { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true },
  );
  const recorderState = useAudioRecorderState(recorder, 100);

  const isRecording = recorderState.isRecording;
  const duration = recorderState.durationMillis ?? 0;
  const rawMetering = recorderState.metering ?? -60;
  const metering = Math.min(1, Math.max(0, (rawMetering + 60) / 60));

  const stoppingRef = useRef(false);

  useEffect(() => {
    checkPermission();
    return () => { deactivateKeepAwake(); };
  }, []);

  const checkPermission = async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    setPermissionGranted(granted);
    if (granted) {
      if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      }
      startRecordingWithPermission();
    }
  };

  const startRecordingWithPermission = async () => {
    try {
      setError(null);
      await setAudioModeAsync({ allowsBackgroundRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      await activateKeepAwakeAsync();
    } catch (err: any) {
      setError('Failed to start recording. Please try again.');
      console.error('Recording start error:', err);
    }
  };

  const startRecording = async () => {
    if (!permissionGranted) {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setError('Microphone permission is required. Please enable it in your device settings.');
        return;
      }
      setPermissionGranted(true);
    }
    startRecordingWithPermission();
  };

  const handleStopRecording = useCallback(async () => {
    if (!recorderState.isRecording || stoppingRef.current) return;
    stoppingRef.current = true;

    try {
      deactivateKeepAwake();
      await recorder.stop();
      const uri = recorder.uri;

      if (!uri) {
        setError('Recording failed. Please try again.');
        stoppingRef.current = false;
        return;
      }

      if (defaultFormat === 'custom' && !customExample) {
        showAlert(
          'Custom Template Missing',
          'Please set a custom template in Settings before using the Custom format.'
        );
        stoppingRef.current = false;
        router.back();
        return;
      }

      const recording = await saveRecording(uri, duration);
      router.replace({
        pathname: `/recording/${recording.id}`,
        params: {
          autoAdvance: 'true',
          formatType: defaultFormat,
          ...(defaultFormat === 'custom' && customExample ? { customExample } : {}),
          ...(customInstructions ? { customInstructions } : {}),
        },
      });
    } catch (err: any) {
      setError('Failed to stop recording. Please try again.');
      console.error('Recording stop error:', err);
      stoppingRef.current = false;
    }
  }, [recorder, recorderState.isRecording, duration, defaultFormat, customExample, customInstructions, saveRecording, router]);

  useEffect(() => {
    if (!isUnlimited && isRecording && duration >= MAX_RECORDING_DURATION_MS) {
      handleStopRecording();
    }
  }, [duration, isRecording, handleStopRecording]);

  const handleCancel = async () => {
    deactivateKeepAwake();
    if (recorderState.isRecording) {
      try {
        await recorder.stop();
      } catch {}
    }
    router.back();
  };

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const maxDurationFormatted = isUnlimited ? '∞' : formatDuration(MAX_RECORDING_DURATION_MS);
  const progress = isUnlimited ? 0 : Math.min(duration / MAX_RECORDING_DURATION_MS, 1);

  if (permissionGranted === false) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <View style={styles.permIconCircle}>
            <View style={styles.permMicBody} />
            <View style={styles.permMicBase} />
          </View>
          <Text style={styles.permissionTitle}>Microphone Access</Text>
          <Text style={styles.permissionText}>
            VoiceKeeper needs microphone access to record voice notes. Please
            enable it in your device settings.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.permButton,
              pressed && styles.permButtonPressed,
            ]}
            onPress={checkPermission}
          >
            <Text style={styles.permButtonText}>Try Again</Text>
          </Pressable>
          <Pressable
            style={styles.permCancelButton}
            onPress={() => router.back()}
          >
            <Text style={styles.permCancelText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable
          onPress={handleCancel}
          style={({ pressed }) => [
            styles.cancelButton,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <View style={styles.recordingIndicator}>
          {isRecording && <View style={styles.recordingDot} />}
          <Text style={styles.recordingLabel}>
            {isRecording ? 'Recording' : 'Ready'}
          </Text>
        </View>
        <View style={{ width: 60 }} />
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

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.maxDuration}>{maxDurationFormatted}</Text>
        </View>

        <View style={styles.controls}>
          {!isRecording ? (
            <Pressable
              style={({ pressed }) => [
                styles.recordButton,
                pressed && { transform: [{ scale: 0.95 }] },
              ]}
              onPress={startRecording}
              accessibilityLabel="Start recording"
            >
              <View style={styles.recordDot} />
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.stopButton,
                pressed && { transform: [{ scale: 0.95 }] },
              ]}
              onPress={handleStopRecording}
              accessibilityLabel="Stop recording"
            >
              <View style={styles.stopSquare} />
            </Pressable>
          )}
        </View>

        <Text style={styles.hint}>
          {isRecording ? 'Tap to stop' : 'Tap to start recording'}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  cancelButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    minWidth: 60,
  },
  cancelText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.recording,
  },
  recordingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  permIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primarySubtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  permMicBody: {
    width: 16,
    height: 24,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  permMicBase: {
    width: 24,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.primary,
    marginTop: 4,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  permButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginBottom: 12,
    ...Colors.shadow.md,
    shadowColor: Colors.primary,
  },
  permButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  permButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  permCancelButton: {
    padding: 12,
  },
  permCancelText: {
    color: Colors.textTertiary,
    fontSize: 15,
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: Colors.errorLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  waveformArea: {
    width: '100%',
    maxWidth: 360,
    marginBottom: 32,
  },
  duration: {
    fontSize: 56,
    fontWeight: '200',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 280,
    marginTop: 12,
    marginBottom: 48,
    gap: 12,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.recording,
    borderRadius: 1.5,
  },
  maxDuration: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  controls: {
    marginBottom: 20,
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
    borderRadius: 6,
    backgroundColor: Colors.recording,
  },
  hint: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
});
