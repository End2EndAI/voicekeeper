import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Recording } from '../types';

const RECORDINGS_KEY = '@voicekeeper/recordings';
const RECORDINGS_DIR = (FileSystem.documentDirectory ?? '') + 'recordings/';

async function ensureRecordingsDir(): Promise<void> {
  if (Platform.OS === 'web') return;
  const info = await FileSystem.getInfoAsync(RECORDINGS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(RECORDINGS_DIR, { intermediates: true });
  }
}

export async function loadRecordings(): Promise<Recording[]> {
  try {
    const raw = await AsyncStorage.getItem(RECORDINGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function persistRecordings(recordings: Recording[]): Promise<void> {
  await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(recordings));
}

export async function saveRecording(
  tempUri: string,
  durationMs: number
): Promise<Recording> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  let localUri: string;

  if (Platform.OS === 'web') {
    // On web, fetch the blob URL and create a persistent object URL
    const response = await fetch(tempUri);
    const blob = await response.blob();
    localUri = URL.createObjectURL(blob);
  } else {
    await ensureRecordingsDir();
    const ext = 'm4a';
    const destPath = `${RECORDINGS_DIR}recording-${id}.${ext}`;
    await FileSystem.copyAsync({ from: tempUri, to: destPath });
    localUri = destPath;
  }

  const recording: Recording = {
    id,
    localUri,
    duration: durationMs,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };

  const existing = await loadRecordings();
  await persistRecordings([recording, ...existing]);
  return recording;
}

export async function updateRecording(
  id: string,
  patch: Partial<Recording>
): Promise<Recording> {
  const recordings = await loadRecordings();
  const idx = recordings.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error(`Recording not found: ${id}`);
  const updated = { ...recordings[idx], ...patch };
  recordings[idx] = updated;
  await persistRecordings(recordings);
  return updated;
}

export async function deleteRecording(id: string): Promise<void> {
  const recordings = await loadRecordings();
  const recording = recordings.find((r) => r.id === id);

  if (recording && Platform.OS !== 'web') {
    try {
      const info = await FileSystem.getInfoAsync(recording.localUri);
      if (info.exists) {
        await FileSystem.deleteAsync(recording.localUri, { idempotent: true });
      }
    } catch {
      // File already gone — continue with metadata removal
    }
  }

  const filtered = recordings.filter((r) => r.id !== id);
  await persistRecordings(filtered);
}
