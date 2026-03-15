import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { showConfirm, showAlert } from '../../utils/alert';
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
          <Text style={styles.notFoundText}>Note not found</Text>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.goBackButton,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.goBackText}>Go Back</Text>
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
      showAlert('Error', 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    showConfirm(
      'Delete Note',
      'Are you sure you want to delete this note? This action cannot be undone.',
      async () => {
        try {
          await deleteNote(note.id);
          router.replace('/');
        } catch {
          showAlert('Error', 'Failed to delete note.');
        }
      }
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
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backPressable,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <View style={styles.topActions}>
          {isEditing ? (
            <>
              <Pressable
                onPress={handleCancelEdit}
                style={({ pressed }) => [
                  styles.actionButton,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.cancelActionText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                style={({ pressed }) => [
                  styles.actionButton,
                  saving && { opacity: 0.4 },
                  pressed && { opacity: 0.6 },
                ]}
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
                style={({ pressed }) => [
                  styles.actionButton,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.editActionText}>Edit</Text>
              </Pressable>
              <Pressable
                onPress={handleDelete}
                style={({ pressed }) => [
                  styles.actionButton,
                  pressed && { opacity: 0.6 },
                ]}
              >
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
            <Markdown style={markdownStyles}>{note.formatted_text}</Markdown>
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

const markdownStyles = {
  body: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 26,
  },
  bullet_list: {
    marginVertical: 4,
  },
  list_item: {
    marginVertical: 2,
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  notFoundText: {
    fontSize: 17,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  goBackButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  goBackText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
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
  },
  backText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  topActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    paddingVertical: 4,
    paddingHorizontal: 4,
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
    fontWeight: '500',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 24,
    paddingBottom: 48,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  date: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 20,
    letterSpacing: -0.3,
    lineHeight: 34,
  },
  titleInput: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
    paddingBottom: 10,
    letterSpacing: -0.3,
  },
  textInput: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 26,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    minHeight: 250,
    backgroundColor: Colors.surface,
  },
  rawSection: {
    backgroundColor: Colors.surfaceHover,
    borderRadius: 14,
    padding: 18,
    marginTop: 28,
  },
  rawLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textTertiary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  rawText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    fontStyle: 'italic',
  },
});
