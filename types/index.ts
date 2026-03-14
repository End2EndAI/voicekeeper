export type FormatType = 'bullet_list' | 'paragraph' | 'action_items' | 'meeting_notes';

export interface Note {
  id: string;
  user_id: string;
  title: string;
  formatted_text: string;
  raw_transcription: string;
  format_type: FormatType;
  audio_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  default_format: FormatType;
  updated_at: string;
}

export interface ProcessingResult {
  transcription: string;
  formatted_text: string;
  title: string;
}

export interface CreateNoteInput {
  title: string;
  formatted_text: string;
  raw_transcription: string;
  format_type: FormatType;
  audio_url?: string | null;
}

export interface UpdateNoteInput {
  title?: string;
  formatted_text?: string;
}
