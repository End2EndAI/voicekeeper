import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useNotes } from '../../contexts/NotesContext';
import { FormatBadge } from '../../components/FormatBadge';
import { Colors } from '../../constants/colors';
import { formatDate } from '../../utils/titleGenerator';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NoteDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { notes, updateNote, deleteNote } = useNotes();

  const note = useMemo(() => notes.find((n) => n.id === id), [notes, id]);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(note?.title ?? '');
  const [editText, setEditText] = useState(note?.formatted_text ?? '');
  const [saving, setSaving] = useState(false);

  if (!note) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Note not found</Text>
          <Pressable onPress={() => router.back()} style={styles.backPressable}>
            <Text style={styles.backText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateNote(note.id, {
        title: editTitle,
        formatted_text: editText,
      });
      setIsEditing(false);
    } catch (err: any) {
      Alert.alert('Error', 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteNote(note.id);
              router.replace('/');
            } catch {
              Alert.alert('Error', 'Failed to delete note.');
            }
          },
        },
      ]
    );
  };

  const handleCancelEdit = () => {
    setEditTitle(note.title);
    setEditText(note.formatted_text);
    setIsEditing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backPressable}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <View style={styles.topActions}>
          {isEditing ? (
            <>
              <Pressable onPress={handleCancelEdit} style={styles.actionButton}>
                <Text style={styles.cancelActionText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                style={[styles.actionButton, saving && { opacity: 0.5 }]}
                disabled={saving}
              >
                <Text style={styles.saveActionText}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                onPress={() => {
                  setEditTitle(note.title);
                  setEditText(note.formatted_text);
                  setIsEditing(true);
                }}
                style={styles.actionButton}
              >
                <Text style={styles.editActionText}>Edit</Text>
              </Pressable>
              <Pressable onPress={handleDelete} style={styles.actionButton}>
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
      >
        <View style={styles.meta}>
          <FormatBadge formatType={note.format_type} size="medium" />
          <Text style={styles.date}>{formatDate(note.created_at)}</Text>
        </View>

        {isEditing ? (
          <>
            <TextInput
              style={styles.titleInput}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Title"
              placeholderTextColor={Colors.textTertiary}
            />
            <TextInput
              style={styles.textInput}
              value={editText}
              onChangeText={setEditText}
              placeholder="Note content"
              placeholderTextColor={Colors.textTertiary}
              multiline
              textAlignVertical="top"
            />
          </>
        ) : (
          <>
            <Text style={styles.title}>{note.title}</Text>
            <Text style={styles.text}>{note.formatted_text}</Text>
          </>
        )}

        {!isEditing && note.raw_transcription && (
          <View style={styles.rawSection}>
            <Text style={styles.rawLabel}>Raw Transcription</Text>
            <Text style={styles.rawText}>{note.raw_transcription}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backPressable: {
    padding: 4,
  },
  backText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  topActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 4,
  },
  editActionText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelActionText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  saveActionText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  deleteText: {
    color: Colors.error,
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  date: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
  },
  titleInput: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
    paddingBottom: 8,
  },
  text: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 26,
  },
  textInput: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 26,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 14,
    minHeight: 250,
    backgroundColor: Colors.surface,
  },
  rawSection: {
    backgroundColor: Colors.surfaceHover,
    borderRadius: 10,
    padding: 16,
    marginTop: 24,
  },
  rawLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textTertiary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rawText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 18,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
});
