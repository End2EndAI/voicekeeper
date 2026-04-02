import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { createNote } from '../services/notes';
import { useNotes } from '../contexts/NotesContext';
import { useTags } from '../contexts/TagsContext';
import { TagChip } from '../components/TagChip';
import { showAlert } from '../utils/alert';

export default function NoteCreateScreen() {
  const router = useRouter();
  const { fetchNotes } = useNotes();
  const { tags, addTagToNote } = useTags();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const contentRef = useRef<TextInput>(null);

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      showAlert('Empty note', 'Please write something before saving.');
      return;
    }

    setSaving(true);
    try {
      const note = await createNote({
        title: trimmedTitle || 'Untitled note',
        formatted_text: trimmedContent,
        raw_transcription: null,
        format_type: 'paragraph',
        source: 'text',
      });
      await Promise.all(selectedTagIds.map((tagId) => addTagToNote(note.id, tagId).catch(() => {})));
      await fetchNotes();
      router.back();
    } catch (err: any) {
      showAlert('Error', 'Failed to save note. Please try again.');
      console.error('Note creation error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>

          <Text style={styles.screenTitle}>New Note</Text>

          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [
              styles.saveButton,
              pressed && { opacity: 0.7 },
              saving && styles.saveButtonDisabled,
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            style={styles.titleInput}
            placeholder="Title"
            placeholderTextColor={Colors.textTertiary}
            value={title}
            onChangeText={setTitle}
            returnKeyType="next"
            onSubmitEditing={() => contentRef.current?.focus()}
            maxLength={200}
          />

          <TextInput
            ref={contentRef}
            style={styles.contentInput}
            placeholder="Write your note..."
            placeholderTextColor={Colors.textTertiary}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
            autoFocus
          />

          {tags.length > 0 && (
            <View style={styles.tagSection}>
              <Text style={styles.tagLabel}>Tags</Text>
              <View style={styles.tagRow}>
                {tags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);
                  return (
                    <Pressable
                      key={tag.id}
                      onPress={() => toggleTag(tag.id)}
                      style={[styles.tagPill, selected && styles.tagPillSelected]}
                    >
                      <TagChip tag={tag} size="small" />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cancelButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    minWidth: 60,
  },
  cancelText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  screenTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  titleInput: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
    padding: 0,
  },
  contentInput: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
    minHeight: 200,
    padding: 0,
  },
  tagSection: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 16,
  },
  tagLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textTertiary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPill: {
    opacity: 0.45,
  },
  tagPillSelected: {
    opacity: 1,
  },
});
