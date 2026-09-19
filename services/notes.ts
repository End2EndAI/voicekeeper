import { supabase } from './supabase';
import { Note } from '../types';

/**
 * Reads for the pull phase of a sync.
 *
 * Writes do not live here any more: every mutation goes through the offline
 * cache and the sync outbox (see services/sync.ts), so that there is exactly
 * one path to the database and nothing can bypass the local copy.
 */

// Toutes les notes de l'utilisateur — actives, archivées et en corbeille — en
// une seule requête. C'est ce que le cache hors-ligne stocke : les écrans
// filtrent ensuite localement au lieu de refaire un aller-retour.
export const fetchAllNotes = async (): Promise<Note[]> => {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};
