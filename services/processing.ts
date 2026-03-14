import { Platform } from 'react-native';
import { supabase } from './supabase';
import { ProcessingResult, FormatType } from '../types';

export const processRecording = async (
  audioUri: string,
  formatType: FormatType
): Promise<ProcessingResult> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  // Read audio file as blob
  const response = await fetch(audioUri);
  const blob = await response.blob();

  // Build form data
  const audioFilename = Platform.OS === 'web' ? 'recording.webm' : 'recording.m4a';
  const formData = new FormData();
  formData.append('audio', blob as any, audioFilename);
  formData.append('format_type', formatType);

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

  // Call edge function
  const result = await fetch(
    `${supabaseUrl}/functions/v1/process-recording`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    }
  );

  if (!result.ok) {
    const error = await result.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(
      error.error || `Processing failed with status ${result.status}`
    );
  }

  return await result.json();
};
