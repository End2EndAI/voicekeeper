import { supabase } from './supabase';
import { Tag } from '../types';

export const fetchTags = async (): Promise<Tag[]> => {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const createTag = async (name: string, color: string): Promise<Tag> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('tags')
    .insert({ name: name.trim(), color, user_id: session.user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateTag = async (
  id: string,
  name: string,
  color: string
): Promise<Tag> => {
  const { data, error } = await supabase
    .from('tags')
    .update({ name: name.trim(), color })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteTag = async (id: string): Promise<void> => {
  const { error } = await supabase.from('tags').delete().eq('id', id);
  if (error) throw error;
};

export const addTagToNote = async (
  noteId: string,
  tagId: string
): Promise<void> => {
  const { error } = await supabase
    .from('note_tags')
    .insert({ note_id: noteId, tag_id: tagId });
  if (error) throw error;
};

export const removeTagFromNote = async (
  noteId: string,
  tagId: string
): Promise<void> => {
  const { error } = await supabase
    .from('note_tags')
    .delete()
    .eq('note_id', noteId)
    .eq('tag_id', tagId);
  if (error) throw error;
};

export const fetchTagsForNote = async (noteId: string): Promise<Tag[]> => {
  const { data, error } = await supabase
    .from('note_tags')
    .select('tags(*)')
    .eq('note_id', noteId);
  if (error) throw error;
  return (data || []).map((row: { tags: Tag }) => row.tags);
};

export const fetchNotesForTag = async (tagId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from('note_tags')
    .select('note_id')
    .eq('tag_id', tagId);
  if (error) throw error;
  return (data || []).map((row: { note_id: string }) => row.note_id);
};
