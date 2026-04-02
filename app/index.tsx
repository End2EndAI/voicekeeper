import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useNotes } from '../contexts/NotesContext';
import { useTags } from '../contexts/TagsContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { NoteGrid } from '../components/NoteGrid';
import { SearchBar } from '../components/SearchBar';
import { RecordButton } from '../components/RecordButton';
import { TagFilterBar } from '../components/TagFilterBar';
import { Colors } from '../constants/colors';
import { Note, NoteSort } from '../types';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as tagsService from '../services/tags';

const SORT_OPTIONS: { value: NoteSort; label: string }[] = [
  { value: 'date_desc', label: 'Newest first' },
  { value: 'date_asc', label: 'Oldest first' },
  { value: 'title_asc', label: 'Title A→Z' },
  { value: 'title_desc', label: 'Title Z→A' },
  { value: 'manual', label: 'Manual order' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { filteredNotes, loading, searchQuery, setSearchQuery, fetchNotes, sort, setSort, setManualOrder } =
    useNotes();
  const { tags, refreshNoteTagsMap } = useTags();
  const { defaultTagId } = usePreferences();

  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [tagNoteIds, setTagNoteIds] = useState<string[] | null>(null);
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);

  // Apply default tag filter on first load
  useEffect(() => {
    if (defaultTagId && tags.length > 0) {
      handleTagSelect(defaultTagId);
    }
  // Only run once when tags become available
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultTagId, tags.length > 0]);

  const handleTagSelect = useCallback(async (tagId: string | null) => {
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
  }, []);

  const handleSortChange = (newSort: NoteSort) => {
    setSort(newSort);
    setShowSortPicker(false);
    if (newSort !== 'manual') setReorderMode(false);
  };

  const displayedNotes = useMemo(() => {
    if (selectedTagId === null || tagNoteIds === null) return filteredNotes;
    return filteredNotes.filter((n) => tagNoteIds.includes(n.id));
  }, [filteredNotes, selectedTagId, tagNoteIds]);

  const handleNotePress = (note: Note) => {
    router.push(`/note/${note.id}`);
  };

  const handleRefresh = async () => {
    await Promise.all([fetchNotes(), refreshNoteTagsMap()]);
  };

  const handleRecord = () => {
    router.push('/record');
  };

  const handleNewTextNote = () => {
    router.push('/note-create');
  };

  const handleSettings = () => {
    router.push('/settings');
  };

  const handleRecordings = () => {
    router.push('/recordings');
  };

  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Sort';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.brand}>
            <Image source={require('../assets/logo_no_bg.png')} style={styles.logo} />
            <Text style={styles.greeting}>VoiceKeeper</Text>
          </View>
          <Pressable
            onPress={() => setShowSortPicker(true)}
            style={({ pressed }) => [styles.subtitleRow, pressed && { opacity: 0.6 }]}
            accessibilityLabel="Sort notes"
          >
            <Text style={styles.subtitle}>
              {displayedNotes.length > 0
                ? `${displayedNotes.length} note${displayedNotes.length !== 1 ? 's' : ''}`
                : 'No notes yet'}
            </Text>
            <Text style={styles.sortIndicator}> · ↕ {currentSortLabel}</Text>
          </Pressable>
        </View>
        <View style={styles.headerActions}>
          {sort === 'manual' && (
            <Pressable
              onPress={() => setReorderMode((v) => !v)}
              style={({ pressed }) => [
                styles.iconButton,
                reorderMode && styles.iconButtonActive,
                pressed && styles.iconButtonPressed,
              ]}
              accessibilityLabel="Toggle reorder mode"
            >
              <View style={styles.reorderIconContainer}>
                <View style={[styles.reorderBar, reorderMode && styles.reorderBarActive]} />
                <View style={[styles.reorderBar, reorderMode && styles.reorderBarActive]} />
                <View style={[styles.reorderBar, reorderMode && styles.reorderBarActive]} />
              </View>
            </Pressable>
          )}
          <Pressable
            onPress={handleRecordings}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.iconButtonPressed,
            ]}
            accessibilityLabel="Recordings"
          >
            <View style={styles.waveformContainer}>
              <View style={[styles.waveBar, { height: 6 }]} />
              <View style={[styles.waveBar, { height: 14 }]} />
              <View style={[styles.waveBar, { height: 10 }]} />
              <View style={[styles.waveBar, { height: 16 }]} />
              <View style={[styles.waveBar, { height: 8 }]} />
            </View>
          </Pressable>
          <Pressable
            onPress={handleSettings}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.iconButtonPressed,
            ]}
            accessibilityLabel="Settings"
          >
            <View style={styles.settingsIconContainer}>
              <View style={styles.gearDot} />
              <View style={styles.gearDot} />
              <View style={styles.gearDot} />
            </View>
          </Pressable>
        </View>
      </View>

      <SearchBar value={searchQuery} onChangeText={setSearchQuery} />

      <TagFilterBar
        tags={tags}
        selectedTagId={selectedTagId}
        onSelect={handleTagSelect}
      />

      <View style={styles.listContainer}>
        <NoteGrid
          notes={displayedNotes}
          loading={loading}
          onNotePress={handleNotePress}
          onRefresh={handleRefresh}
          hasActiveFilter={selectedTagId !== null}
          draggable={sort === 'manual'}
          reorderMode={reorderMode}
          onReorder={setManualOrder}
        />
      </View>

      <RecordButton onPress={handleRecord} onTextNotePress={handleNewTextNote} />

      {/* Sort picker modal */}
      <Modal
        visible={showSortPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowSortPicker(false)}>
          <View style={styles.sortSheet}>
            <Text style={styles.sortSheetTitle}>Sort notes</Text>
            {SORT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={({ pressed }) => [
                  styles.sortOption,
                  sort === opt.value && styles.sortOptionActive,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => handleSortChange(opt.value)}
              >
                <Text style={[styles.sortOptionText, sort === opt.value && styles.sortOptionTextActive]}>
                  {opt.label}
                </Text>
                {sort === opt.value && <Text style={styles.sortCheckmark}>✓</Text>}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
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
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  sortIndicator: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...Colors.shadow.sm,
  },
  iconButtonPressed: {
    backgroundColor: Colors.surfaceHover,
    transform: [{ scale: 0.95 }],
  },
  iconButtonActive: {
    backgroundColor: Colors.primarySubtle,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  reorderIconContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    gap: 3,
  },
  reorderBar: {
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: Colors.textSecondary,
  },
  reorderBarActive: {
    backgroundColor: Colors.primary,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    height: 20,
  },
  waveBar: {
    width: 2.5,
    borderRadius: 1.5,
    backgroundColor: Colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sortSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  sortSheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  sortOptionActive: {
    backgroundColor: Colors.primarySubtle,
  },
  sortOptionText: {
    fontSize: 16,
    color: Colors.text,
  },
  sortOptionTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  sortCheckmark: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '700',
  },
  settingsIconContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
  },
  gearDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textSecondary,
  },
  listContainer: {
    flex: 1,
  },
});
