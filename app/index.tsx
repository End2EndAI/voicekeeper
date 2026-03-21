import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useNotes } from '../contexts/NotesContext';
import { useTags } from '../contexts/TagsContext';
import { NoteGrid } from '../components/NoteGrid';
import { SearchBar } from '../components/SearchBar';
import { RecordButton } from '../components/RecordButton';
import { TagFilterBar } from '../components/TagFilterBar';
import { Colors } from '../constants/colors';
import { Note } from '../types';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as tagsService from '../services/tags';

export default function HomeScreen() {
  const router = useRouter();
  const { filteredNotes, loading, searchQuery, setSearchQuery, fetchNotes } =
    useNotes();
  const { tags } = useTags();

  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [tagNoteIds, setTagNoteIds] = useState<string[] | null>(null);

  const handleTagSelect = async (tagId: string | null) => {
    setSelectedTagId(tagId);
    if (tagId === null) {
      setTagNoteIds(null);
    } else {
      try {
        const ids = await tagsService.fetchNotesForTag(tagId);
        setTagNoteIds(ids);
      } catch {
        setTagNoteIds([]);
      }
    }
  };

  const displayedNotes = useMemo(() => {
    if (selectedTagId === null || tagNoteIds === null) return filteredNotes;
    return filteredNotes.filter((n) => tagNoteIds.includes(n.id));
  }, [filteredNotes, selectedTagId, tagNoteIds]);

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
            <Image source={require('../assets/logo_no_bg.png')} style={styles.logo} />
            <Text style={styles.greeting}>VoiceKeeper</Text>
          </View>
          <Text style={styles.subtitle}>
            {displayedNotes.length > 0
              ? `${displayedNotes.length} note${displayedNotes.length !== 1 ? 's' : ''}`
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

      <TagFilterBar
        tags={tags}
        selectedTagId={selectedTagId}
        onSelect={handleTagSelect}
      />

      <NoteGrid
        notes={displayedNotes}
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
