import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { ProcessingResult, FormatType } from '../types';

const WHISPER_MAX_BYTES = 25 * 1024 * 1024; // 25 MB — OpenAI Whisper API limit
const CHUNK_BYTES = 24 * 1024 * 1024;        // 24 MB per chunk (1 MB safety margin)

function sliceBlob(blob: Blob): Blob[] {
  const chunks: Blob[] = [];
  let offset = 0;
  while (offset < blob.size) {
    chunks.push(blob.slice(offset, offset + CHUNK_BYTES, blob.type));
    offset += CHUNK_BYTES;
  }
  return chunks;
}

export const transcribeRecording = async (
  localUri: string
): Promise<string> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Not authenticated');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

  const sendChunk = async (formData: FormData): Promise<string> => {
    const result = await fetch(
      `${supabaseUrl}/functions/v1/process-recording`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: supabaseAnonKey,
        },
        body: formData,
      }
    );
    if (!result.ok) {
      const error = await result.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(
        error.message || error.error || `Transcription failed with status ${result.status}`
      );
    }
    const data = await result.json();
    return data.transcription as string;
  };

  if (Platform.OS === 'web') {
    const response = await fetch(localUri);
    const blob = await response.blob();

    if (blob.size <= WHISPER_MAX_BYTES) {
      const formData = new FormData();
      formData.append('audio', blob as any, 'recording.webm');
      formData.append('mode', 'transcribe_only');
      return sendChunk(formData);
    }

    // File exceeds 25 MB: split, transcribe each chunk, join results
    const chunks = sliceBlob(blob);
    const parts: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const formData = new FormData();
      formData.append('audio', chunks[i] as any, `recording-part${i + 1}.webm`);
      formData.append('mode', 'transcribe_only');
      parts.push(await sendChunk(formData));
    }
    return parts.join(' ');
  }

  // Native: check file size before deciding whether to split
  const info = await FileSystem.getInfoAsync(localUri);
  const fileSize = info.exists ? info.size : 0;

  if (!fileSize || fileSize <= WHISPER_MAX_BYTES) {
    const formData = new FormData();
    formData.append('audio', { uri: localUri, type: 'audio/m4a', name: 'recording.m4a' } as any);
    formData.append('mode', 'transcribe_only');
    return sendChunk(formData);
  }

  // File exceeds 25 MB: read as base64, split into chunks, write temp files
  // Base64 chars per chunk: (CHUNK_BYTES / 3) * 4 — always a multiple of 4 for valid base64
  const charsPerChunk = (CHUNK_BYTES / 3) * 4;
  const base64Full = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const tempUris: string[] = [];
  let offset = 0;
  let i = 0;
  while (offset < base64Full.length) {
    const chunkB64 = base64Full.slice(offset, offset + charsPerChunk);
    const tempUri = `${FileSystem.cacheDirectory}chunk-${Date.now()}-${i}.m4a`;
    await FileSystem.writeAsStringAsync(tempUri, chunkB64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    tempUris.push(tempUri);
    offset += charsPerChunk;
    i++;
  }

  try {
    const parts: string[] = [];
    for (let j = 0; j < tempUris.length; j++) {
      const formData = new FormData();
      formData.append('audio', { uri: tempUris[j], type: 'audio/m4a', name: `recording-part${j + 1}.m4a` } as any);
      formData.append('mode', 'transcribe_only');
      parts.push(await sendChunk(formData));
    }
    return parts.join(' ');
  } finally {
    await Promise.all(tempUris.map(uri => FileSystem.deleteAsync(uri, { idempotent: true })));
  }
};

export const formatTranscription = async (
  rawTranscription: string,
  formatType: FormatType,
  customExample?: string,
  customInstructions?: string,
  autotaggingEnabled?: boolean,
  userTagNames?: string[]
): Promise<ProcessingResult> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Not authenticated');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const formData = new FormData();
  formData.append('mode', 'format_only');
  formData.append('raw_transcription', rawTranscription);
  formData.append('format_type', formatType);

  if (formatType === 'custom' && customExample) {
    formData.append('custom_example', customExample);
  }
  if (customInstructions) {
    formData.append('custom_instructions', customInstructions);
  }
  if (autotaggingEnabled) {
    formData.append('autotagging_enabled', 'true');
    formData.append('user_tags', JSON.stringify(userTagNames ?? []));
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  const result = await fetch(
    `${supabaseUrl}/functions/v1/process-recording`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: supabaseAnonKey || '',
      },
      body: formData,
    }
  );

  if (!result.ok) {
    const error = await result.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(
      error.message || error.error || `Formatting failed with status ${result.status}`
    );
  }

  return await result.json() as ProcessingResult;
};

export const processRecording = async (
  audioUri: string,
  formatType: FormatType,
  customExample?: string,
  customInstructions?: string,
  autotaggingEnabled?: boolean,
  userTagNames?: string[]
): Promise<ProcessingResult> => {
  // Step 1: transcribe
  const rawTranscription = await transcribeRecording(audioUri);

  // Step 2: format
  const result = await formatTranscription(
    rawTranscription,
    formatType,
    customExample,
    customInstructions,
    autotaggingEnabled,
    userTagNames
  );

  return result;
};
