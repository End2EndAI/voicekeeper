import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { showAlert } from '../utils/alert';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { processRecording } from '../services/processing';
import { useNotes } from '../contexts/NotesContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { useTags } from '../contexts/TagsContext';
import { FormatBadge } from '../components/FormatBadge';
import { TagChip } from '../components/TagChip';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { Colors } from '../constants/colors';
import { FormatType, ProcessingResult, Tag } from '../types';
import { SafeAreaView } from 'react-native-safe-area-context';

const DEFAULT_TAGS_CONFIG: Array<{ name: string; color: string }> = [
  { name: 'start-up', color: '#f59e0b' },
  { name: 'travail', color: '#3b82f6' },
  { name: 'investissement', color: '#10b981' },
  { name: 'personnel', color: '#8b5cf6' },
  { name: 'idées', color: '#ec4899' },
];

export default function PreviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    audioUri: string;
    formatType: string;
    customExample?: string;
    customInstructions?: string;
  }>();
  const { createNote } = useNotes();
  const { autotaggingEnabled } = usePreferences();
  const { tags, createTag, addTagToNote, fetchTags } = useTags();

  const audioUri = params.audioUri || '';
  const formatType = (params.formatType || 'bullet_list') as FormatType;
  const customExample = params.customExample;
  const customInstructions = params.customInstructions;

  const [processing, setProcessing] = useState(true);
  const [processingMessage, setProcessingMessage] = useState(
    'Processing your note...'
  );
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dailyLimitReached, setDailyLimitReached] = useState(false);
  const [editableTitle, setEditableTitle] = useState('');
  const [editableText, setEditableText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Tag state for this preview
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);

  useEffect(() => {
    processAudio();
  }, []);

  const ensureDefaultTags = async (): Promise<Tag[]> => {
    // If user has no tags, create default ones
    if (tags.length === 0) {
      const created: Tag[] = [];
      for (const { name, color } of DEFAULT_TAGS_CONFIG) {
        try {
          const tag = await createTag(name, color);
          created.push(tag);
        } catch {
          // Tag may already exist, ignore
        }
      }
      // Refresh tag list
      await fetchTags();
      return created;
    }
    return tags;
  };

  const processAudio = async () => {
    try {
      setProcessing(true);
      setError(null);
      setProcessingMessage('Transcribing your recording...');

      let currentTags = tags;
      let tagNamesToSend: string[] = [];

      if (autotaggingEnabled) {
        setProcessingMessage('Preparing tags...');
        if (tags.length === 0) {
          currentTags = await ensureDefaultTags();
        }
        tagNamesToSend = currentTags.map((t) => t.name);
      }

      setProcessingMessage('Processing your note...');

      const processingResult = await processRecording(
        audioUri,
        formatType,
        customExample || undefined,
        customInstructions || undefined,
        autotaggingEnabled,
        tagNamesToSend
      );

      setResult(processingResult);
      setEditableTitle(processingResult.title);
      setEditableText(processingResult.formatted_text);

      if (processingResult.suggested_tags && processingResult.suggested_tags.length > 0) {
        setSelectedTagNames(processingResult.suggested_tags);
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to process recording';
      if (msg.includes('daily limit') || msg.includes('daily_limit_reached')) {
        setDailyLimitReached(true);
      }
      setError(msg);
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveSuggestedTag = (tagName: string) => {
    setSelectedTagNames((prev) => prev.filter((n) => n !== tagName));
  };

  const handleAddTag = (tagName: string) => {
    if (!selectedTagNames.includes(tagName)) {
      setSelectedTagNames((prev) => [...prev, tagName]);
    }
  };

  const handleSave = async () => {
    if (!result) return;

    setSaving(true);
    try {
      const note = await createNote({
        title: editableTitle,
        formatted_text: editableText,
        raw_transcription: result.transcription,
        format_type: formatType,
      });

      // Save selected tags to the note
      if (selectedTagNames.length > 0 && note) {
        const tagMap = new Map(tags.map((t) => [t.name, t.id]));
        for (const tagName of selectedTagNames) {
          const tagId = tagMap.get(tagName);
          if (tagId) {
            try {
              await addTagToNote(note.id, tagId);
            } catch {
              // Non-fatal: log and continue
              console.error(`Failed to add tag "${tagName}" to note`);
            }
          }
        }
      }

      router.replace('/');
    } catch (err: any) {
      showAlert('Save Failed', err.message || 'Could not save the note.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.replace('/');
  };

  if (processing) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingOverlay visible={true} message={processingMessage} />
      </SafeAreaView>
    );
  }

  if (dailyLimitReached) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <View style={styles.limitIconCircle}>
            <Text style={styles.limitIconText}>5/5</Text>
          </View>
          <Text style={styles.errorTitle}>Daily Limit Reached</Text>
          <Text style={styles.errorMessage}>
            You've used all 5 free notes for today. This limit helps us keep VoiceKeeper free while covering AI processing costs.
          </Text>
          <Text style={styles.limitSubtext}>
            Your notes reset every day at midnight UTC.{'\n'}
            Subscription plans are coming soon!
          </Text>
          <Pressable style={styles.errorCancelPressable} onPress={handleCancel}>
            <Text style={styles.limitGoBackText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <View style={styles.errorIconCircle}>
            <Text style={styles.errorIconText}>!</Text>
          </View>
          <Text style={styles.errorTitle}>Processing Failed</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            onPress={processAudio}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
          <Pressable style={styles.errorCancelPressable} onPress={handleCancel}>
            <Text style={styles.errorCancelText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Tags available to add (not already selected)
  const availableTagsToAdd = tags.filter((t) => !selectedTagNames.includes(t.name));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable
          onPress={handleCancel}
          style={({ pressed }) => [
            styles.topButton,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.topTitle}>Preview</Text>
        <Pressable
          onPress={() => setIsEditing(!isEditing)}
          style={({ pressed }) => [
            styles.topButton,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text style={styles.editText}>{isEditing ? 'Done' : 'Edit'}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
      >
        <FormatBadge formatType={formatType} size="medium" />

        <View style={styles.titleSection}>
          {isEditing ? (
            <TextInput
              style={styles.titleInput}
              value={editableTitle}
              onChangeText={setEditableTitle}
              placeholder="Note title"
              placeholderTextColor={Colors.textTertiary}
              multiline={false}
              accessibilityLabel="Edit note title"
            />
          ) : (
            <Text style={styles.title}>{editableTitle}</Text>
          )}
        </View>

        <View style={styles.textSection}>
          {isEditing ? (
            <TextInput
              style={styles.textInput}
              value={editableText}
              onChangeText={setEditableText}
              placeholder="Note content"
              placeholderTextColor={Colors.textTertiary}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Edit note content"
            />
          ) : (
            <Markdown style={markdownStyles}>{editableText}</Markdown>
          )}
        </View>

        {/* Suggested / selected tags section */}
        {autotaggingEnabled && (
          <View style={styles.tagsSection}>
            <Text style={styles.tagsSectionLabel}>Tags</Text>

            {selectedTagNames.length > 0 && (
              <View style={styles.selectedTagsRow}>
                {selectedTagNames.map((name) => {
                  const tag = tags.find((t) => t.name === name);
                  if (!tag) return null;
                  return (
                    <View key={name} style={styles.tagChipWrapper}>
                      <TagChip tag={tag} />
                      <Pressable
                        onPress={() => handleRemoveSuggestedTag(name)}
                        style={({ pressed }) => [
                          styles.removeTagButton,
                          pressed && { opacity: 0.6 },
                        ]}
                        accessibilityLabel={`Remove tag ${name}`}
                      >
                        <Text style={styles.removeTagText}>✕</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}

            {availableTagsToAdd.length > 0 && (
              <View style={styles.addTagsRow}>
                <Text style={styles.addTagsLabel}>Add:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.addTagsScroll}>
                  {availableTagsToAdd.map((tag) => (
                    <Pressable
                      key={tag.id}
                      onPress={() => handleAddTag(tag.name)}
                      style={({ pressed }) => [
                        styles.addTagChip,
                        pressed && { opacity: 0.6 },
                      ]}
                      accessibilityLabel={`Add tag ${tag.name}`}
                    >
                      <View style={[styles.addTagDot, { backgroundColor: tag.color }]} />
                      <Text style={styles.addTagName}>{tag.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {result?.transcription && (
          <View style={styles.rawSection}>
            <Text style={styles.rawLabel}>Raw Transcription</Text>
            <Text style={styles.rawText}>{result.transcription}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            saving && styles.saveButtonDisabled,
            pressed && !saving && { opacity: 0.85, transform: [{ scale: 0.99 }] },
          ]}
          onPress={handleSave}
          disabled={saving}
          accessibilityLabel="Save note"
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Note'}
          </Text>
        </Pressable>
      </View>
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  topButton: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    minWidth: 56,
  },
  topTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
  },
  cancelText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  editText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 24,
    paddingBottom: 120,
  },
  titleSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.3,
    lineHeight: 32,
  },
  titleInput: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
    paddingBottom: 10,
    letterSpacing: -0.3,
  },
  textSection: {
    marginBottom: 24,
  },
  textInput: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 26,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    minHeight: 200,
    backgroundColor: Colors.surface,
  },
  tagsSection: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  tagsSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textTertiary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  selectedTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tagChipWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  removeTagButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.surfaceHover,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeTagText: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  addTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addTagsLabel: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  addTagsScroll: {
    flex: 1,
  },
  addTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceHover,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
    gap: 5,
  },
  addTagDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  addTagName: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  rawSection: {
    backgroundColor: Colors.surfaceHover,
    borderRadius: 14,
    padding: 18,
    marginTop: 8,
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
  bottomBar: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    ...Colors.shadow.md,
    shadowColor: Colors.primary,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  errorIconText: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.error,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginBottom: 12,
    ...Colors.shadow.md,
    shadowColor: Colors.primary,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorCancelPressable: {
    padding: 12,
  },
  errorCancelText: {
    color: Colors.textTertiary,
    fontSize: 15,
    fontWeight: '500',
  },
  limitIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primarySubtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  limitIconText: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
  },
  limitSubtext: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  limitGoBackText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
