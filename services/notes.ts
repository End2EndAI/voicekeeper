import { supabase } from './supabase';
import { Note, CreateNoteInput, UpdateNoteInput } from '../types';

export const fetchNotes = async (): Promise<Note[]> => {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createNote = async (note: CreateNoteInput): Promise<Note> => {
  const { data, error } = await supabase
    .from('notes')
    .insert(note)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateNote = async (
  id: string,
  updates: UpdateNoteInput
): Promise<Note> => {
  const { data, error } = await supabase
    .from('notes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteNote = async (id: string): Promise<void> => {
  const { error } = await supabase.from('notes').delete().eq('id', id);
  if (error) throw error;
};

export const searchNotes = async (query: string): Promise<Note[]> => {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .or(
      `title.ilike.%${query}%,formatted_text.ilike.%${query}%,raw_transcription.ilike.%${query}%`
    )
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};
