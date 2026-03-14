import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

let SecureStore: typeof import('expo-secure-store') | null = null;

if (Platform.OS !== 'web') {
  try {
    SecureStore = require('expo-secure-store');
  } catch {
    // expo-secure-store not available (web)
  }
}

const ExpoSecureStoreAdapter = {
  getItem: (key: string): Promise<string | null> => {
    if (SecureStore) {
      return SecureStore.getItemAsync(key);
    }
    return Promise.resolve(
      typeof window !== 'undefined' ? localStorage.getItem(key) : null
    );
  },
  setItem: (key: string, value: string): Promise<void> => {
    if (SecureStore) {
      return SecureStore.setItemAsync(key, value);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value);
    }
    return Promise.resolve();
  },
  removeItem: (key: string): Promise<void> => {
    if (SecureStore) {
      return SecureStore.deleteItemAsync(key);
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
    return Promise.resolve();
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
