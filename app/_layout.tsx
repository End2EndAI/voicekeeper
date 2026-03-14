import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { PreferencesProvider } from '../contexts/PreferencesContext';
import { NotesProvider } from '../contexts/NotesContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

function RootLayoutNav() {
  const { session, loading } = useAuth();

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
        {session ? (
          <>
            <Stack.Screen
              name="index"
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
          </>
        ) : (
          <Stack.Screen
            name="login"
            options={{ title: 'VoiceKeeper', headerShown: false }}
          />
        )}
      </Stack>
    </>
  );
}

export default function RootLayout() {
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
