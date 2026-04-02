export type FormatType = 'bullet_list' | 'paragraph' | 'action_items' | 'meeting_notes' | 'custom';

export type NoteSort = 'date_desc' | 'date_asc' | 'title_asc' | 'title_desc' | 'manual';

export type RecordingStatus =
  | 'pending'       // audio saved locally, not yet transcribed
  | 'transcribing'  // transcription API call in progress
  | 'transcribed'   // rawTranscription populated
  | 'formatting'    // formatting API call in progress
  | 'formatted'     // formattedTitle + formattedText populated
  | 'saved';        // note created in Supabase, noteId populated

export interface UncertainTerm {
  original: string;
  suggestion: string | null;
}

export interface Recording {
  id: string;                  // uuid v4, generated on device
  localUri: string;            // absolute path in documentDirectory/recordings/
  duration: number;            // milliseconds
  fileSizeBytes?: number;      // audio file size in bytes (used to check Whisper 25MB limit)
  createdAt: string;           // ISO 8601 timestamp
  status: RecordingStatus;
  rawTranscription?: string;   // set after Transcribe step
  uncertainTerms?: UncertainTerm[]; // set after Transcribe step (acronym validation)
  formattedTitle?: string;     // set after Format step
  formattedText?: string;      // set after Format step
  formatType?: FormatType;     // set when Format is triggered
  suggestedTags?: string[];    // set after Format step (autotagging)
  noteId?: string;             // Supabase note id once saved
}

export type NoteSource = 'voice' | 'text';

export interface Note {
  id: string;
  user_id: string;
  title: string;
  formatted_text: string;
  raw_transcription?: string | null;
  format_type: FormatType;
  source: NoteSource;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  deleted_at?: string | null;
  audio_uri?: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  default_format: FormatType;
  custom_example: string | null;
  custom_instructions: string | null;
  autotagging_enabled: boolean;
  default_tag_id: string | null;
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
  suggested_tags?: string[];
}

export interface CreateNoteInput {
  title: string;
  formatted_text: string;
  raw_transcription?: string | null;
  format_type: FormatType;
  audio_uri?: string;
  source?: NoteSource;
}

export interface UpdateNoteInput {
  title?: string;
  formatted_text?: string;
  format_type?: FormatType;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}
