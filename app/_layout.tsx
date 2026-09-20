import React, { useEffect } from 'react';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { PreferencesProvider } from '../contexts/PreferencesContext';
import { NotesProvider } from '../contexts/NotesContext';
import { TagsProvider } from '../contexts/TagsContext';
import { RecordingsProvider } from '../contexts/RecordingsContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { consumePendingRoute, setPendingRoute } from '../utils/pendingRoute';

export const unstable_settings = {
  // The Android record widget deep links straight into /record. Anchoring the
  // stack on the home screen gives that screen something to go back to —
  // otherwise Cancel would leave the user stranded on a modal with no parent.
  initialRouteName: 'index',
};

function useProtectedRoute() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const isOnLogin = segments[0] === 'login';

    if (!session && !isOnLogin) {
      // Hold on to where the deep link was going so sign-in can resume it
      setPendingRoute(pathname);
      router.replace('/login');
    } else if (session && isOnLogin) {
      const pending = consumePendingRoute();
      router.replace('/');
      // Pushed on top of home rather than replacing it, so the resumed screen
      // keeps a back stack.
      if (pending) router.push(pending);
    }
  }, [session, loading, segments, pathname]);

  return { loading };
}

function RootLayoutNav() {
  const { loading } = useProtectedRoute();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen
          name="index"
          options={{ title: 'VoiceKeeper', headerShown: false }}
        />
        <Stack.Screen
          name="login"
          options={{ title: 'VoiceKeeper', headerShown: false }}
        />
        <Stack.Screen
          name="record"
          options={{
            title: 'Record',
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="note-create"
          options={{
            title: 'New Note',
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="preview"
          options={{ title: 'Preview', headerShown: false }}
        />
        <Stack.Screen
          name="note/[id]"
          options={{ title: 'Note', headerShown: false }}
        />
        <Stack.Screen
          name="recording/[id]"
          options={{ title: 'Recording', headerShown: false }}
        />
        <Stack.Screen
          name="settings"
          options={{ title: 'Settings', headerShown: false }}
        />
        <Stack.Screen
          name="recordings"
          options={{ title: 'Recordings', headerShown: false }}
        />
        <Stack.Screen
          name="archive"
          options={{ title: 'Archive', headerShown: false }}
        />
        <Stack.Screen
          name="trash"
          options={{ title: 'Trash', headerShown: false }}
        />
        <Stack.Screen
          name="acronyms"
          options={{ title: 'Saved Terms', headerShown: false }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <NotesProvider>
          <TagsProvider>
            <RecordingsProvider>
              <RootLayoutNav />
            </RecordingsProvider>
          </TagsProvider>
        </NotesProvider>
      </PreferencesProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
