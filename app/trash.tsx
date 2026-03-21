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
import { fetchTrashedNotes, deleteNotePermanently as deletePermanentlyService } from '../services/notes';
import { useNotes } from '../contexts/NotesContext';
import { showConfirm, showAlert } from '../utils/alert';
import { formatDate } from '../utils/titleGenerator';
import { FormatBadge } from '../components/FormatBadge';

function getDaysRemaining(deletedAt: string): number {
  const deletedDate = new Date(deletedAt);
  const expiresAt = new Date(deletedDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function getDaysRemainingLabel(deletedAt: string): string {
  const days = getDaysRemaining(deletedAt);
  if (days === 0) return 'Deletes today';
  if (days === 1) return 'Deletes tomorrow';
  return `Deletes in ${days} days`;
}

export default function TrashScreen() {
  const router = useRouter();
  const { restoreNote } = useNotes();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTrashedNotes = useCallback(async () => {
    try {
      const data = await fetchTrashedNotes();
      setNotes(data);
    } catch (error) {
      console.error('Failed to fetch trashed notes:', error);
      showAlert('Error', 'Could not load trash.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTrashedNotes();
  }, [loadTrashedNotes]);

  const handleRestore = useCallback(
    async (note: Note) => {
      try {
        await restoreNote(note.id);
        setNotes((prev) => prev.filter((n) => n.id !== note.id));
      } catch {
        showAlert('Error', 'Could not restore note.');
      }
    },
    [restoreNote]
  );

  const handleDeletePermanently = useCallback((note: Note) => {
    showConfirm(
      'Delete Permanently',
      `"${note.title}" will be permanently deleted. This cannot be undone.`,
      async () => {
        try {
          await deletePermanentlyService(note.id);
          setNotes((prev) => prev.filter((n) => n.id !== note.id));
        } catch {
          showAlert('Error', 'Could not delete note.');
        }
      }
    );
  }, []);

  const handleEmptyTrash = useCallback(() => {
    if (notes.length === 0) return;
    showConfirm(
      'Empty Trash',
      `Permanently delete all ${notes.length} note${notes.length > 1 ? 's' : ''} in trash? This cannot be undone.`,
      async () => {
        try {
          await Promise.all(notes.map((n) => deletePermanentlyService(n.id)));
          setNotes([]);
        } catch {
          showAlert('Error', 'Could not empty trash.');
          loadTrashedNotes();
        }
      }
    );
  }, [notes, loadTrashedNotes]);

  const renderItem = ({ item }: { item: Note }) => {
    const daysLabel = item.deleted_at ? getDaysRemainingLabel(item.deleted_at) : '';
    const daysRemaining = item.deleted_at ? getDaysRemaining(item.deleted_at) : 30;
    const isUrgent = daysRemaining <= 3;

    return (
      <View style={styles.noteCard}>
        <View style={styles.noteContent}>
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
          <Text style={[styles.daysLabel, isUrgent && styles.daysLabelUrgent]}>
            {daysLabel}
          </Text>
        </View>
        <View style={styles.noteActions}>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.restoreButton,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => handleRestore(item)}
            accessibilityLabel="Restore note"
          >
            <Text style={styles.restoreButtonText}>Restore</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.deleteButton,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => handleDeletePermanently(item)}
            accessibilityLabel="Delete permanently"
          >
            <Text style={styles.deleteButtonText}>Delete forever</Text>
          </Pressable>
        </View>
      </View>
    );
  };

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
        <Text style={styles.topTitle}>Trash</Text>
        {notes.length > 0 ? (
          <Pressable
            onPress={handleEmptyTrash}
            style={({ pressed }) => [
              styles.emptyTrashPressable,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.emptyTrashText}>Empty</Text>
          </Pressable>
        ) : (
          <View style={{ width: 56 }} />
        )}
      </View>

      {notes.length > 0 && (
        <View style={styles.infoBar}>
          <Text style={styles.infoText}>
            Notes in trash are automatically deleted after 30 days.
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : notes.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🗑</Text>
          <Text style={styles.emptyTitle}>Trash is empty</Text>
          <Text style={styles.emptyDesc}>
            Deleted notes appear here for 30 days before being permanently removed.
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
            loadTrashedNotes();
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
  emptyTrashPressable: {
    paddingVertical: 4,
    minWidth: 56,
    alignItems: 'flex-end',
  },
  emptyTrashText: {
    color: Colors.error,
    fontSize: 15,
    fontWeight: '600',
  },
  infoBar: {
    backgroundColor: Colors.warningLight,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  infoText: {
    fontSize: 13,
    color: Colors.warning,
    fontWeight: '500',
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
    marginBottom: 8,
  },
  daysLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
    marginTop: 4,
  },
  daysLabelUrgent: {
    color: Colors.error,
    fontWeight: '600',
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
  restoreButton: {
    borderRightWidth: 1,
    borderRightColor: Colors.borderLight,
  },
  restoreButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  deleteButton: {},
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.error,
  },
});
