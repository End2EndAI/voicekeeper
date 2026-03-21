import { supabase } from './supabase';
import { AdminUser } from '../types';

export const getAdminUsers = async (): Promise<AdminUser[]> => {
  const { data, error } = await supabase.rpc('admin_get_all_users');

  if (error) throw new Error(error.message);

  return (data ?? []) as AdminUser[];
};

export const setUserRole = async (
  userId: string,
  tier: 'free' | 'unlimited',
  isAdmin: boolean
): Promise<void> => {
  const { error } = await supabase.rpc('admin_set_user_role', {
    p_target_user_id: userId,
    p_tier: tier,
    p_is_admin: isAdmin,
  });

  if (error) throw new Error(error.message);
};
