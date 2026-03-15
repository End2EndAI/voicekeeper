import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
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
          <Text style={styles.title}>VoiceKeeper</Text>
          <Text style={styles.subtitle}>Your voice notes</Text>
        </View>
        <Pressable
          onPress={handleSettings}
          style={styles.settingsButton}
          accessibilityLabel="Settings"
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  settingsButton: {
    padding: 8,
    borderRadius: 20,
  },
  settingsIcon: {
    fontSize: 24,
  },
});
