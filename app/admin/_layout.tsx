import { useEffect } from 'react';
import { Slot, useRouter } from 'expo-router';
import { usePreferences } from '../../contexts/PreferencesContext';

export default function AdminLayout() {
  const router = useRouter();
  const { isAdmin, loading } = usePreferences();

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace('/');
    }
  }, [isAdmin, loading, router]);

  if (loading || !isAdmin) {
    return null;
  }

  return <Slot />;
}
