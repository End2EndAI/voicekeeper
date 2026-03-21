export type FormatType = 'bullet_list' | 'paragraph' | 'action_items' | 'meeting_notes' | 'custom';

export interface Note {
  id: string;
  user_id: string;
  title: string;
  formatted_text: string;
  raw_transcription: string;
  format_type: FormatType;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  deleted_at?: string | null;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  default_format: FormatType;
  custom_example: string | null;
  custom_instructions: string | null;
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
}

export interface UpdateNoteInput {
  title?: string;
  formatted_text?: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}
