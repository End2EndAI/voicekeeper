import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { showConfirm, showAlert } from '../../utils/alert';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useNotes } from '../../contexts/NotesContext';
import { useTags } from '../../contexts/TagsContext';
import { usePreferences } from '../../contexts/PreferencesContext';
import { FormatBadge } from '../../components/FormatBadge';
import { TagChip } from '../../components/TagChip';
import { TagPicker } from '../../components/TagPicker';
import { Colors } from '../../constants/colors';
import { FORMAT_OPTIONS } from '../../constants/formats';
import { formatDate } from '../../utils/titleGenerator';
import { formatTranscription } from '../../services/processing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tag, FormatType } from '../../types';
import { AudioPlaybackBar } from '../../components/AudioPlaybackBar';

// Parses action_items markdown into a structured list with tappable checkboxes.
// Toggling a checkbox updates the underlying markdown text and persists via onTextChange.
function ActionItemsList({ text, onTextChange }: { text: string; onTextChange?: (updated: string) => void }) {
  const lines = text.split('\n');

  const toggle = (lineIndex: number) => {
    const updated = lines.map((line, i) => {
      if (i !== lineIndex) return line;
      if (line.match(/^-\s+\[\s\]\s+/)) return line.replace(/^(-\s+)\[\s\]/, '$1[x]');
      if (line.match(/^-\s+\[x\]\s+/i)) return line.replace(/^(-\s+)\[x\]/i, '$1[ ]');
      return line;
    }).join('\n');
    onTextChange?.(updated);
  };

  return (
    <View>
      {lines.map((line, i) => {
        const unchecked = line.match(/^-\s+\[\s\]\s+(.+)/);
        const checked = line.match(/^-\s+\[x\]\s+(.+)/i);
        if (unchecked || checked) {
          const isChecked = !!checked;
          const label = (unchecked ?? checked)![1];
          return (
            <Pressable key={i} style={actionStyles.row} onPress={() => toggle(i)}>
              <View style={[actionStyles.checkbox, isChecked && actionStyles.checkboxChecked]}>
                {isChecked && <Text style={actionStyles.checkmark}>✓</Text>}
              </View>
              <Text style={[actionStyles.label, isChecked && actionStyles.labelChecked]}>
                {label}
              </Text>
            </Pressable>
          );
        }
        if (!line.trim()) return null;
        return <Markdown key={i} style={markdownStyles}>{line}</Markdown>;
      })}
    </View>
  );
}

const actionStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 6,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  label: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
  },
  labelChecked: {
    color: Colors.textTertiary,
    textDecorationLine: 'line-through',
  },
});

export default function NoteDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { notes, updateNote, deleteNote, archiveNote } = useNotes();
  const { tags, createTag, addTagToNote, removeTagFromNote, fetchTagsForNote } =
    useTags();
  const { customExample } = usePreferences();

  const note = useMemo(() => notes.find((n) => n.id === id), [notes, id]);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(note?.title ?? '');
  const [editText, setEditText] = useState(note?.formatted_text ?? '');
  const [editFormatType, setEditFormatType] = useState<FormatType>(note?.format_type ?? 'paragraph');
  const [saving, setSaving] = useState(false);
  const titleInputRef = useRef<TextInput>(null);

  const [showFormatPicker, setShowFormatPicker] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<FormatType | null>(null);
  const [reformatInstructions, setReformatInstructions] = useState('');
  const [reformatting, setReformatting] = useState(false);

  useEffect(() => {
    if (isEditing) {
      setTimeout(() => titleInputRef.current?.focus(), 50);
    }
  }, [isEditing]);

  const [noteTags, setNoteTags] = useState<Tag[]>([]);
  const [tagPickerVisible, setTagPickerVisible] = useState(false);

  useEffect(() => {
    if (id) {
      fetchTagsForNote(id).then(setNoteTags).catch(console.error);
    }
  }, [id, fetchTagsForNote]);

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
        format_type: editFormatType,
      });
      setIsEditing(false);
    } catch (err: unknown) {
      showAlert('Error', 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = () => {
    showConfirm(
      'Archive Note',
      'This note will be moved to your archive. You can restore it from Settings > Archive.',
      async () => {
        try {
          await archiveNote(note.id);
          router.replace('/');
        } catch {
          showAlert('Error', 'Failed to archive note.');
        }
      }
    );
  };

  const handleDelete = () => {
    showConfirm(
      'Move to Trash',
      'This note will be moved to trash and permanently deleted after 30 days.',
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
    setEditFormatType(note.format_type);
    setIsEditing(false);
    setShowFormatPicker(false);
    setReformatInstructions('');
    setSelectedFormat(null);
  };

  const handleReformat = async (formatType: FormatType) => {
    setSelectedFormat(formatType);
    setReformatting(true);
    try {
      const result = await formatTranscription(
        editText,
        formatType,
        formatType === 'custom' ? customExample || undefined : undefined,
        reformatInstructions || undefined,
      );
      setEditTitle(result.title);
      setEditText(result.formatted_text);
      setEditFormatType(formatType);
      setShowFormatPicker(false);
      setReformatInstructions('');
      setSelectedFormat(null);
    } catch (err: unknown) {
      showAlert('Error', 'Failed to reformat note. Please try again.');
    } finally {
      setReformatting(false);
    }
  };

  const handleToggleTag = async (tagId: string) => {
    const isAdded = noteTags.some((t) => t.id === tagId);
    try {
      if (isAdded) {
        await removeTagFromNote(note.id, tagId);
        setNoteTags((prev) => prev.filter((t) => t.id !== tagId));
      } else {
        await addTagToNote(note.id, tagId);
        const tag = tags.find((t) => t.id === tagId);
        if (tag) setNoteTags((prev) => [...prev, tag]);
      }
    } catch {
      showAlert('Error', 'Failed to update tags.');
    }
  };

  const handleCreateTag = async (name: string, color: string) => {
    try {
      const tag = await createTag(name, color);
      await addTagToNote(note.id, tag.id);
      setNoteTags((prev) => [...prev, tag]);
    } catch {
      showAlert('Error', 'Failed to create tag.');
    }
  };

  const selectedTagIds = noteTags.map((t) => t.id);

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
                onPress={() => setShowFormatPicker((v) => !v)}
                disabled={reformatting}
                style={({ pressed }) => [
                  styles.actionButton,
                  pressed && { opacity: 0.6 },
                  reformatting && { opacity: 0.4 },
                ]}
              >
                <Text style={styles.formatActionText}>Format</Text>
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
                  setEditFormatType(note.format_type);
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
                onPress={handleArchive}
                style={({ pressed }) => [
                  styles.actionButton,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.archiveText}>Archive</Text>
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

        {note.audio_uri && <AudioPlaybackBar localUri={note.audio_uri} />}

        {isEditing ? (
          <>
            <TextInput
              ref={titleInputRef}
              style={styles.titleInput}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Title"
              placeholderTextColor={Colors.textTertiary}
              selectTextOnFocus
              returnKeyType="next"
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

            {/* Inline format picker */}
            {showFormatPicker && (
              <View style={styles.formatPicker}>
                <Text style={styles.formatPickerTitle}>Format as…</Text>
                <Text style={styles.formatInstructionsLabel}>Custom instructions (optional)</Text>
                <TextInput
                  style={styles.formatInstructionsInput}
                  value={reformatInstructions}
                  onChangeText={setReformatInstructions}
                  placeholder='e.g. "Be concise", "Translate in English"'
                  placeholderTextColor="#aaa"
                  multiline
                  textAlignVertical="top"
                />
                {reformatting ? (
                  <View style={styles.reformattingRow}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={styles.reformattingText}>Reformatting…</Text>
                  </View>
                ) : (
                  <>
                    {FORMAT_OPTIONS.map((opt) => (
                      <Pressable
                        key={opt.value}
                        style={({ pressed }) => [
                          styles.formatOption,
                          selectedFormat === opt.value && styles.formatOptionSelected,
                          pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
                        ]}
                        onPress={() => handleReformat(opt.value)}
                      >
                        <Text style={styles.formatOptionIcon}>{opt.icon}</Text>
                        <View>
                          <Text style={styles.formatOptionLabel}>{opt.label}</Text>
                          <Text style={styles.formatOptionDesc}>{opt.description}</Text>
                        </View>
                      </Pressable>
                    ))}
                    <Pressable
                      style={styles.formatCancelButton}
                      onPress={() => setShowFormatPicker(false)}
                    >
                      <Text style={styles.formatCancelText}>Cancel</Text>
                    </Pressable>
                  </>
                )}
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={styles.title}>{note.title}</Text>
            {note.format_type === 'action_items' ? (
              <ActionItemsList
                text={note.formatted_text}
                onTextChange={(updated) => updateNote(note.id, { formatted_text: updated })}
              />
            ) : (
              <Markdown style={markdownStyles}>{note.formatted_text}</Markdown>
            )}
          </>
        )}

        {/* Tags section */}
        <View style={styles.tagsSection}>
          <View style={styles.tagsHeader}>
            <Text style={styles.tagsLabel}>Tags</Text>
            <Pressable
              onPress={() => setTagPickerVisible(true)}
              style={({ pressed }) => [
                styles.editTagsButton,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.editTagsText}>
                {noteTags.length === 0 ? '+ Add' : 'Edit'}
              </Text>
            </Pressable>
          </View>
          {noteTags.length > 0 ? (
            <View style={styles.tagsList}>
              {noteTags.map((tag) => (
                <TagChip
                  key={tag.id}
                  tag={tag}
                  onRemove={() => handleToggleTag(tag.id)}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.noTagsText}>No tags</Text>
          )}
        </View>

        {!isEditing && note.raw_transcription && (
          <View style={styles.rawSection}>
            <Text style={styles.rawLabel}>Raw Transcription</Text>
            <Text style={styles.rawText}>{note.raw_transcription}</Text>
          </View>
        )}
      </ScrollView>

      <TagPicker
        visible={tagPickerVisible}
        onClose={() => setTagPickerVisible(false)}
        allTags={tags}
        selectedTagIds={selectedTagIds}
        onToggle={handleToggleTag}
        onCreateTag={handleCreateTag}
      />
    </SafeAreaView>
  );
}

const markdownStyles = {
  body: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 26,
  },
  // Headings (meeting_notes uses ## for sections)
  heading2: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 20,
    marginBottom: 6,
    letterSpacing: 0.1,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingBottom: 4,
  },
  heading3: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginTop: 14,
    marginBottom: 4,
  },
  // Lists
  bullet_list: {
    marginVertical: 4,
  },
  ordered_list: {
    marginVertical: 4,
  },
  list_item: {
    marginVertical: 3,
  },
  // Checkbox items (action_items uses - [ ] and - [x])
  // react-native-markdown-display renders these via bullet_list + list_item
  // The checkbox character is part of the text content
  strong: {
    fontWeight: '700' as const,
    color: Colors.text,
  },
  em: {
    fontStyle: 'italic' as const,
    color: Colors.textSecondary,
  },
  code_inline: {
    fontFamily: 'monospace',
    backgroundColor: Colors.surfaceHover,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    fontSize: 14,
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
  formatActionText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '500',
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
  archiveText: {
    color: Colors.warning,
    fontSize: 16,
    fontWeight: '500',
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
  tagsSection: {
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  tagsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  tagsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  editTagsButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.primarySubtle,
  },
  editTagsText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  noTagsText: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontStyle: 'italic',
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
  formatPicker: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  formatPickerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  formatInstructionsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 12,
    marginBottom: 6,
  },
  formatInstructionsInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: Colors.text,
    minHeight: 60,
    backgroundColor: Colors.background,
    marginBottom: 8,
  },
  formatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  formatOptionSelected: {
    backgroundColor: Colors.primarySubtle,
  },
  formatOptionIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  formatOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  formatOptionDesc: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  formatCancelButton: {
    marginTop: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  formatCancelText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  reformattingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  reformattingText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
});
