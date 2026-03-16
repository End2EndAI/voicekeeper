import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { PreferencesProvider } from '../contexts/PreferencesContext';
import { NotesProvider } from '../contexts/NotesContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import * as Linking from 'expo-linking';
import { supabase } from '../services/supabase';

function useProtectedRoute() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const isOnLogin = segments[0] === 'login';

    if (!session && !isOnLogin) {
      router.replace('/login');
    } else if (session && isOnLogin) {
      router.replace('/');
    }
  }, [session, loading, segments]);

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
          name="preview"
          options={{ title: 'Preview', headerShown: false }}
        />
        <Stack.Screen
          name="note/[id]"
          options={{ title: 'Note', headerShown: false }}
        />
        <Stack.Screen
          name="settings"
          options={{ title: 'Settings', headerShown: false }}
        />
      </Stack>
    </>
  );
}

function parseTokensFromUrl(url: string): { access_token?: string; refresh_token?: string } {
  const fragment = url.includes('#') ? url.split('#')[1] : url.split('?')[1] ?? '';
  const params = new URLSearchParams(fragment);
  return {
    access_token: params.get('access_token') ?? undefined,
    refresh_token: params.get('refresh_token') ?? undefined,
  };
}

async function handleAuthUrl(url: string) {
  const { access_token, refresh_token } = parseTokensFromUrl(url);
  if (access_token && refresh_token) {
    await supabase.auth.setSession({ access_token, refresh_token });
  }
}

export default function RootLayout() {
  useEffect(() => {
    // Handle deep link that opened the app (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) handleAuthUrl(url);
    });

    // Handle deep link while app is already open (warm start)
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleAuthUrl(url);
    });

    return () => subscription.remove();
  }, []);

  return (
    <AuthProvider>
      <PreferencesProvider>
        <NotesProvider>
          <RootLayoutNav />
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
