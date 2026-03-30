import { supabase } from './supabase';

export interface ValidatedTerm {
  original_term: string;
  corrected_term: string;
}

export const loadValidatedTerms = async (): Promise<ValidatedTerm[]> => {
  const { data, error } = await supabase
    .from('user_validated_terms')
    .select('original_term, corrected_term');
  if (error) throw error;
  return data ?? [];
};

export const saveValidatedTerms = async (terms: ValidatedTerm[]): Promise<void> => {
  if (terms.length === 0) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const rows = terms.map((t) => ({
    user_id: user.id,
    original_term: t.original_term,
    corrected_term: t.corrected_term,
  }));

  const { error } = await supabase
    .from('user_validated_terms')
    .upsert(rows, { onConflict: 'user_id,original_term' });
  if (error) throw error;
};

export const deleteValidatedTerm = async (originalTerm: string): Promise<void> => {
  const { error } = await supabase
    .from('user_validated_terms')
    .delete()
    .eq('original_term', originalTerm);
  if (error) throw error;
};

export const deleteAllValidatedTerms = async (): Promise<void> => {
  const { error } = await supabase
    .from('user_validated_terms')
    .delete()
    .neq('original_term', '');
  if (error) throw error;
};
