import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Export all user data (GDPR Art. 20 - Right to data portability)
 * Returns a JSON object with all user data
 */
export const exportUserData = async (): Promise<object> => {
  const { data, error } = await supabase.rpc('export_user_data');
  if (error) throw new Error(`Data export failed: ${error.message}`);
  return data;
};

/**
 * Delete user account and all associated data (GDPR Art. 17 - Right to erasure)
 * Calls the delete-account Edge Function which handles:
 * - Notes deletion
 * - Preferences deletion
 * - Audit log entry
 * - Auth user deletion
 */
export const deleteAccount = async (): Promise<void> => {
  // Force server-side token validation/refresh before using the access token
  await supabase.auth.getUser();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('delete-account', {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    // Extract the actual error message from the edge function response body
    let errorMessage = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json();
        errorMessage = body.error || body.message || errorMessage;
      } catch {
        // ignore JSON parsing errors, keep generic message
      }
    }
    throw new Error(`Account deletion failed: ${errorMessage}`);
  }
  if (data && !data.success) throw new Error(data.error || 'Account deletion failed');

  // Sign out locally after server-side deletion
  await supabase.auth.signOut();
};
