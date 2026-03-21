import { supabase } from './supabase';
import { Note, CreateNoteInput, UpdateNoteInput } from '../types';

export const fetchNotes = async (): Promise<Note[]> => {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .is('deleted_at', null)
    .is('archived_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createNote = async (note: CreateNoteInput): Promise<Note> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('notes')
    .insert({ ...note, user_id: session.user.id })
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

// Soft delete — déplace la note en corbeille
export const deleteNote = async (id: string): Promise<void> => {
  return trashNote(id);
};

// Déplace une note vers la corbeille (soft delete)
export const trashNote = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
};

// Restaure une note depuis la corbeille
export const restoreNote = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('notes')
    .update({ deleted_at: null })
    .eq('id', id);
  if (error) throw error;
};

// Supprime définitivement une note (depuis la corbeille uniquement)
export const deleteNotePermanently = async (id: string): Promise<void> => {
  const { error } = await supabase.from('notes').delete().eq('id', id);
  if (error) throw error;
};

// Archive une note (la retire de la vue principale)
export const archiveNote = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('notes')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
};

// Désarchive une note (la remet dans la vue principale)
export const unarchiveNote = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('notes')
    .update({ archived_at: null })
    .eq('id', id);
  if (error) throw error;
};

// Récupère les notes archivées
export const fetchArchivedNotes = async (): Promise<Note[]> => {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .is('deleted_at', null)
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

// Récupère les notes en corbeille
export const fetchTrashedNotes = async (): Promise<Note[]> => {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const searchNotes = async (query: string): Promise<Note[]> => {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .is('deleted_at', null)
    .is('archived_at', null)
    .or(
      `title.ilike.%${query}%,formatted_text.ilike.%${query}%,raw_transcription.ilike.%${query}%`
    )
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};
