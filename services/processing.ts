import { Platform } from 'react-native';
import { supabase } from './supabase';
import { ProcessingResult, FormatType } from '../types';

export const transcribeRecording = async (
  localUri: string
): Promise<string> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Not authenticated');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const formData = new FormData();
  if (Platform.OS === 'web') {
    const response = await fetch(localUri);
    const blob = await response.blob();
    formData.append('audio', blob as any, 'recording.webm');
  } else {
    formData.append('audio', {
      uri: localUri,
      type: 'audio/m4a',
      name: 'recording.m4a',
    } as any);
  }
  formData.append('mode', 'transcribe_only');

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
      error.message || error.error || `Transcription failed with status ${result.status}`
    );
  }

  const data = await result.json();
  return data.transcription as string;
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
