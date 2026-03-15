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
import { FormatBadge } from '../components/FormatBadge';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { Colors } from '../constants/colors';
import { FormatType, ProcessingResult } from '../types';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PreviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    audioUri: string;
    formatType: string;
    customExample?: string;
    customInstructions?: string;
  }>();
  const { createNote } = useNotes();

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
  const [editableTitle, setEditableTitle] = useState('');
  const [editableText, setEditableText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    processAudio();
  }, []);

  const processAudio = async () => {
    try {
      setProcessing(true);
      setError(null);
      setProcessingMessage('Transcribing your recording...');

      const processingResult = await processRecording(
        audioUri,
        formatType,
        customExample || undefined,
        customInstructions || undefined
      );

      setResult(processingResult);
      setEditableTitle(processingResult.title);
      setEditableText(processingResult.formatted_text);
    } catch (err: any) {
      setError(err.message || 'Failed to process recording');
    } finally {
      setProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;

    setSaving(true);
    try {
      await createNote({
        title: editableTitle,
        formatted_text: editableText,
        raw_transcription: result.transcription,
        format_type: formatType,
      });
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
});
