import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
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
  }>();
  const { createNote } = useNotes();

  const audioUri = params.audioUri || '';
  const formatType = (params.formatType || 'bullet_list') as FormatType;
  const customExample = params.customExample;

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
        customExample || undefined
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
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Processing Failed</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={processAudio}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
          <Pressable style={styles.cancelPressable} onPress={handleCancel}>
            <Text style={styles.cancelText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={handleCancel} style={styles.cancelPressable}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.topTitle}>Preview</Text>
        <Pressable
          onPress={() => setIsEditing(!isEditing)}
          style={styles.editPressable}
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
            <Text style={styles.text}>{editableText}</Text>
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
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
  topTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
  },
  cancelPressable: {
    padding: 4,
  },
  cancelText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  editPressable: {
    padding: 4,
  },
  editText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  titleSection: {
    marginTop: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
  },
  titleInput: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
    paddingBottom: 8,
  },
  textSection: {
    marginBottom: 24,
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
    minHeight: 200,
    backgroundColor: Colors.surface,
  },
  rawSection: {
    backgroundColor: Colors.surfaceHover,
    borderRadius: 10,
    padding: 16,
    marginTop: 8,
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
  bottomBar: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
