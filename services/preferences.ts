import { supabase } from './supabase';
import { FormatType, UserPreferences } from '../types';

export const fetchPreferences = async (): Promise<UserPreferences | null> => {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .single();

  if (error) {
    // If no preferences found, that's ok (will use defaults)
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
};

export const updateDefaultFormat = async (
  format: FormatType
): Promise<UserPreferences> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: user.id, default_format: format },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateCustomInstructions = async (
  customInstructions: string
): Promise<UserPreferences> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: user.id, custom_instructions: customInstructions },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateCustomExample = async (
  customExample: string
): Promise<UserPreferences> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: user.id, custom_example: customExample },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const setAutotaggingEnabled = async (enabled: boolean): Promise<void> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: user.id, autotagging_enabled: enabled },
      { onConflict: 'user_id' }
    );

  if (error) throw error;
};

export const setDefaultTagId = async (tagId: string | null): Promise<void> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: user.id, default_tag_id: tagId },
      { onConflict: 'user_id' }
    );

  if (error) throw error;
};
