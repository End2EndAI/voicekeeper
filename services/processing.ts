import { Platform } from 'react-native';
import { supabase } from './supabase';
import { ProcessingResult, FormatType } from '../types';

export const processRecording = async (
  audioUri: string,
  formatType: FormatType,
  customExample?: string,
  customInstructions?: string
): Promise<ProcessingResult> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  // Build form data
  const formData = new FormData();
  if (Platform.OS === 'web') {
    // Web: fetch the blob URL and append as blob
    const response = await fetch(audioUri);
    const blob = await response.blob();
    formData.append('audio', blob as any, 'recording.webm');
  } else {
    // React Native (iOS/Android): use native file attachment — works with expo-audio file URIs
    formData.append('audio', { uri: audioUri, type: 'audio/m4a', name: 'recording.m4a' } as any);
  }
  formData.append('format_type', formatType);

  // Pass custom example when format is custom
  if (formatType === 'custom' && customExample) {
    formData.append('custom_example', customExample);
  }

  // Pass custom instructions (applies to all formats)
  if (customInstructions) {
    formData.append('custom_instructions', customInstructions);
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  // Call edge function
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
      error.message || error.error || `Processing failed with status ${result.status}`
    );
  }

  return await result.json();
};
