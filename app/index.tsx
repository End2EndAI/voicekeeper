import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useNotes } from '../contexts/NotesContext';
import { NoteGrid } from '../components/NoteGrid';
import { SearchBar } from '../components/SearchBar';
import { RecordButton } from '../components/RecordButton';
import { Colors } from '../constants/colors';
import { Note } from '../types';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const router = useRouter();
  const { filteredNotes, loading, searchQuery, setSearchQuery, fetchNotes } =
    useNotes();

  const handleNotePress = (note: Note) => {
    router.push(`/note/${note.id}`);
  };

  const handleRecord = () => {
    router.push('/record');
  };

  const handleSettings = () => {
    router.push('/settings');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <View style={styles.brand}>
            <Image source={require('../assets/logo.png')} style={styles.logo} />
            <Text style={styles.greeting}>VoiceKeeper</Text>
          </View>
          <Text style={styles.subtitle}>
            {filteredNotes.length > 0
              ? `${filteredNotes.length} note${filteredNotes.length !== 1 ? 's' : ''}`
              : 'No notes yet'}
          </Text>
        </View>
        <Pressable
          onPress={handleSettings}
          style={({ pressed }) => [
            styles.settingsButton,
            pressed && styles.settingsButtonPressed,
          ]}
          accessibilityLabel="Settings"
        >
          <View style={styles.settingsIconContainer}>
            <View style={styles.gearDot} />
            <View style={[styles.gearDot, styles.gearDot2]} />
            <View style={[styles.gearDot, styles.gearDot3]} />
          </View>
        </Pressable>
      </View>

      <SearchBar value={searchQuery} onChangeText={setSearchQuery} />

      <NoteGrid
        notes={filteredNotes}
        loading={loading}
        onNotePress={handleNotePress}
        onRefresh={fetchNotes}
      />

      <RecordButton onPress={handleRecord} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...Colors.shadow.sm,
  },
  settingsButtonPressed: {
    backgroundColor: Colors.surfaceHover,
    transform: [{ scale: 0.95 }],
  },
  settingsIconContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gearDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textSecondary,
    marginVertical: 1.5,
  },
  gearDot2: {},
  gearDot3: {},
});
