import { Audio } from 'expo-av';
import { Platform } from 'react-native';

const RECORDING_OPTIONS = {
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

export const requestMicrophonePermission = async (): Promise<boolean> => {
  const { granted } = await Audio.requestPermissionsAsync();
  return granted;
};

export const checkMicrophonePermission = async (): Promise<boolean> => {
  const { granted } = await Audio.getPermissionsAsync();
  return granted;
};

export const prepareRecording = async (): Promise<Audio.Recording> => {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
  return recording;
};

export const stopRecording = async (
  recording: Audio.Recording
): Promise<string> => {
  await recording.stopAndUnloadAsync();

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
  });

  const uri = recording.getURI();
  if (!uri) throw new Error('Recording URI is null');
  return uri;
};

export const getRecordingDuration = async (
  recording: Audio.Recording
): Promise<number> => {
  const status = await recording.getStatusAsync();
  return status.isRecording ? status.durationMillis : 0;
};

export const getRecordingMetering = async (
  recording: Audio.Recording
): Promise<number> => {
  const status = await recording.getStatusAsync();
  if (status.isRecording && status.metering !== undefined) {
    // Normalize metering from dB (-160 to 0) to 0-1 range
    const normalized = Math.max(0, (status.metering + 60) / 60);
    return Math.min(1, normalized);
  }
  return 0;
};
