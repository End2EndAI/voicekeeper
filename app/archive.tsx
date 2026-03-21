import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { Note } from '../types';
import { fetchArchivedNotes } from '../services/notes';
import { useNotes } from '../contexts/NotesContext';
import { showConfirm, showAlert } from '../utils/alert';
import { formatDate } from '../utils/titleGenerator';
import { FormatBadge } from '../components/FormatBadge';

export default function ArchiveScreen() {
  const router = useRouter();
  const { unarchiveNote, trashNote } = useNotes();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadArchivedNotes = useCallback(async () => {
    try {
      const data = await fetchArchivedNotes();
      setNotes(data);
    } catch (error) {
      console.error('Failed to fetch archived notes:', error);
      showAlert('Error', 'Could not load archived notes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadArchivedNotes();
  }, [loadArchivedNotes]);

  const handleUnarchive = useCallback(
    async (note: Note) => {
      try {
        await unarchiveNote(note.id);
        setNotes((prev) => prev.filter((n) => n.id !== note.id));
      } catch {
        showAlert('Error', 'Could not unarchive note.');
      }
    },
    [unarchiveNote]
  );

  const handleTrash = useCallback(
    (note: Note) => {
      showConfirm(
        'Move to Trash',
        `Move "${note.title}" to trash? It will be permanently deleted after 30 days.`,
        async () => {
          try {
            await trashNote(note.id);
            setNotes((prev) => prev.filter((n) => n.id !== note.id));
          } catch {
            showAlert('Error', 'Could not move note to trash.');
          }
        }
      );
    },
    [trashNote]
  );

  const renderItem = ({ item }: { item: Note }) => (
    <View style={styles.noteCard}>
      <Pressable
        style={styles.noteContent}
        onPress={() => router.push(`/note/${item.id}`)}
      >
        <View style={styles.noteMeta}>
          <FormatBadge formatType={item.format_type} size="small" />
          <Text style={styles.noteDate}>{formatDate(item.created_at)}</Text>
        </View>
        <Text style={styles.noteTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {item.formatted_text ? (
          <Text style={styles.notePreview} numberOfLines={2}>
            {item.formatted_text.replace(/[#*_~`]/g, '')}
          </Text>
        ) : null}
      </Pressable>
      <View style={styles.noteActions}>
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            styles.unarchiveButton,
            pressed && { opacity: 0.7 },
          ]}
          onPress={() => handleUnarchive(item)}
          accessibilityLabel="Unarchive note"
        >
          <Text style={styles.unarchiveButtonText}>Unarchive</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            styles.trashButton,
            pressed && { opacity: 0.7 },
          ]}
          onPress={() => handleTrash(item)}
          accessibilityLabel="Move to trash"
        >
          <Text style={styles.trashButtonText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backPressable,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.topTitle}>Archive</Text>
        <View style={{ width: 56 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : notes.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🗂</Text>
          <Text style={styles.emptyTitle}>No archived notes</Text>
          <Text style={styles.emptyDesc}>
            Notes you archive will appear here. They stay safe until you unarchive or delete them.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onRefresh={() => {
            setRefreshing(true);
            loadArchivedNotes();
          }}
          refreshing={refreshing}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backPressable: {
    paddingVertical: 4,
    minWidth: 56,
  },
  backText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  topTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  noteCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
    ...Colors.shadow.sm,
  },
  noteContent: {
    padding: 16,
  },
  noteMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noteDate: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
    lineHeight: 22,
  },
  notePreview: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  noteActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  unarchiveButton: {
    borderRightWidth: 1,
    borderRightColor: Colors.borderLight,
  },
  unarchiveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  trashButton: {},
  trashButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.error,
  },
});
