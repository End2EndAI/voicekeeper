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
}

export interface UserPreferences {
  id: string;
  user_id: string;
  default_format: FormatType;
  custom_example: string | null;
  custom_instructions: string | null;
  updated_at: string;
  is_admin?: boolean;
}

export interface AdminUser {
  user_id: string;
  email: string;
  created_at: string;
  tier: 'free' | 'unlimited';
  is_admin: boolean;
  note_count_30d: number;
  note_count_total: number;
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
