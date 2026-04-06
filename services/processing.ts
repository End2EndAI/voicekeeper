import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { ProcessingResult, FormatType, UncertainTerm } from '../types';
import { splitAudioWeb, splitAudioNative } from './audio-splitter';

export interface TranscribeResult {
  transcription: string;
  uncertainTerms: UncertainTerm[];
}

const WHISPER_MAX_BYTES = 25 * 1024 * 1024; // 25 MB — OpenAI Whisper API limit

export const transcribeRecording = async (
  localUri: string,
  knownTerms?: Array<{ original_term: string; corrected_term: string }>
): Promise<TranscribeResult> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Not authenticated');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

  const sendChunk = async (formData: FormData): Promise<TranscribeResult> => {
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
    return {
      transcription: data.transcription as string,
      uncertainTerms: (data.uncertain_terms as UncertainTerm[]) ?? [],
    };
  };

  const knownTermsJson = knownTerms && knownTerms.length > 0 ? JSON.stringify(knownTerms) : null;

  if (Platform.OS === 'web') {
    const response = await fetch(localUri);
    const blob = await response.blob();

    if (blob.size <= WHISPER_MAX_BYTES) {
      const formData = new FormData();
      formData.append('audio', blob as any, 'recording.webm');
      formData.append('mode', 'transcribe_only');
      if (knownTermsJson) formData.append('known_terms', knownTermsJson);
      return sendChunk(formData);
    }

    // File exceeds 25 MB: decode audio, split into valid WAV chunks, transcribe each
    // Uncertain terms from fragment chunks are meaningless — skip them
    const chunks = await splitAudioWeb(blob);
    const parts: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const formData = new FormData();
      formData.append('audio', chunks[i] as any, `recording-part${i + 1}.wav`);
      formData.append('mode', 'transcribe_only');
      const { transcription } = await sendChunk(formData);
      parts.push(transcription);
    }
    return { transcription: parts.join(' '), uncertainTerms: [] };
  }

  // Native: check file size before deciding whether to split
  const info = await FileSystem.getInfoAsync(localUri);
  const fileSize = info.exists ? info.size : 0;

  if (!fileSize || fileSize <= WHISPER_MAX_BYTES) {
    const formData = new FormData();
    formData.append('audio', { uri: localUri, type: 'audio/m4a', name: 'recording.m4a' } as any);
    formData.append('mode', 'transcribe_only');
    if (knownTermsJson) formData.append('known_terms', knownTermsJson);
    return sendChunk(formData);
  }

  // File exceeds 25 MB: parse M4A container, split at sample boundaries into valid M4A chunks
  const tempUris = await splitAudioNative(localUri);

  try {
    const parts: string[] = [];
    for (let j = 0; j < tempUris.length; j++) {
      const formData = new FormData();
      formData.append('audio', { uri: tempUris[j], type: 'audio/m4a', name: `recording-part${j + 1}.m4a` } as any);
      formData.append('mode', 'transcribe_only');
      const { transcription } = await sendChunk(formData);
      parts.push(transcription);
    }
    // Uncertain terms from fragment chunks are meaningless — skip them
    return { transcription: parts.join(' '), uncertainTerms: [] };
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
  userTagNames?: string[],
  validatedTerms?: Array<{ original_term: string; corrected_term: string }>
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
  if (validatedTerms && validatedTerms.length > 0) {
    formData.append('validated_terms', JSON.stringify(validatedTerms));
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
): Promise<ProcessingResult & { uncertainTerms: UncertainTerm[] }> => {
  // Step 1: transcribe
  const { transcription: rawTranscription, uncertainTerms } =
    await transcribeRecording(audioUri);

  // Step 2: format
  const result = await formatTranscription(
    rawTranscription,
    formatType,
    customExample,
    customInstructions,
    autotaggingEnabled,
    userTagNames
  );

  return { ...result, uncertainTerms };
};
