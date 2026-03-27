import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  ActivityIndicator, TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Markdown from 'react-native-markdown-display';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRecordings } from '../../contexts/RecordingsContext';
import { useNotes } from '../../contexts/NotesContext';
import { usePreferences } from '../../contexts/PreferencesContext';
import { useTags } from '../../contexts/TagsContext';
import { transcribeRecording, formatTranscription } from '../../services/processing';
import { loadValidatedTerms, saveValidatedTerms } from '../../services/validatedTerms';
import { Colors } from '../../constants/colors';
import { FORMAT_OPTIONS } from '../../constants/formats';
import { FormatType, RecordingStatus, UncertainTerm } from '../../types';
import { showAlert, showConfirm } from '../../utils/alert';
import { AudioPlaybackBar } from '../../components/AudioPlaybackBar';
import { AcronymValidationModal } from '../../components/AcronymValidationModal';

// Status badge colors
const STATUS_COLORS: Record<RecordingStatus, string> = {
  pending: Colors.textTertiary,
  transcribing: Colors.primary,
  transcribed: '#f59e0b',
  formatting: Colors.primary,
  formatted: '#10b981',
  saved: Colors.primary,
};

const STATUS_LABELS: Record<RecordingStatus, string> = {
  pending: 'Pending',
  transcribing: 'Transcribing…',
  transcribed: 'Transcribed',
  formatting: 'Formatting…',
  formatted: 'Formatted',
  saved: 'Saved as Note',
};

export default function RecordingDetailScreen() {
  const router = useRouter();
  const { id, autoAdvance, formatType: formatTypeParam, customExample, customInstructions } =
    useLocalSearchParams<{
      id: string;
      autoAdvance?: string;
      formatType?: string;
      customExample?: string;
      customInstructions?: string;
    }>();

  const { recordings, updateRecording, deleteRecording } = useRecordings();
  const { createNote } = useNotes();
  const { defaultFormat, autotaggingEnabled } = usePreferences();
  const { tags, fetchTags, addTagToNote } = useTags();

  const recording = useMemo(
    () => recordings.find((r) => r.id === id),
    [recordings, id]
  );

  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<FormatType>(
    (formatTypeParam as FormatType) ?? defaultFormat
  );
  const [showFormatPicker, setShowFormatPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reformatInstructions, setReformatInstructions] = useState(customInstructions ?? '');

  // Acronym validation state
  const [pendingTerms, setPendingTerms] = useState<UncertainTerm[]>([]);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [pendingFormatType, setPendingFormatType] = useState<FormatType | null>(null);

  // E4-S3: Auto-advance guard — prevents double-fire in React StrictMode
  const autoAdvanceRef = useRef(false);

  useEffect(() => {
    // Guard: only run once, only if autoAdvance=true and status is pending
    if (
      autoAdvance !== 'true' ||
      autoAdvanceRef.current ||
      !recording ||
      recording.status !== 'pending'
    ) {
      return;
    }
    autoAdvanceRef.current = true;

    const runAutoAdvance = async () => {
      // Step 1: Transcribe
      setActionError(null);
      try {
        await updateRecording(id, { status: 'transcribing' });
        const { transcription: rawTranscription, uncertainTerms } =
          await transcribeRecording(recording.localUri);
        await updateRecording(id, { status: 'transcribed', rawTranscription, uncertainTerms });

        // If there are uncertain terms, pause for user validation before formatting
        if (uncertainTerms.length > 0) {
          setPendingTerms(uncertainTerms);
          setPendingFormatType((formatTypeParam as FormatType) ?? defaultFormat);
          setShowValidationModal(true);
          return; // formatting continues after modal confirmation
        }

        // Step 2: Format (using the format type from navigation params)
        const formatType = (formatTypeParam as FormatType) ?? defaultFormat;
        try {
          await updateRecording(id, { status: 'formatting', formatType });

          let currentTags: string[] = [];
          if (autotaggingEnabled) {
            await fetchTags();
            currentTags = tags.map((t) => t.name);
          }

          const existingTerms = await loadValidatedTerms();
          const result = await formatTranscription(
            rawTranscription,
            formatType,
            customExample || undefined,
            customInstructions || undefined,
            autotaggingEnabled,
            currentTags,
            existingTerms
          );

          await updateRecording(id, {
            status: 'formatted',
            formattedTitle: result.title,
            formattedText: result.formatted_text,
            suggestedTags: result.suggested_tags,
          });
        } catch (fmtErr: any) {
          // Format failed: revert to transcribed, show manual retry
          await updateRecording(id, { status: 'transcribed' });
          setActionError(fmtErr.message || 'Formatting failed. Tap Format to try again.');
        }
      } catch (txErr: any) {
        // Transcribe failed: revert to pending, show manual retry
        await updateRecording(id, { status: 'pending' });
        setActionError(txErr.message || 'Transcription failed. Tap Transcribe to try again.');
      }
    };

    runAutoAdvance();
  }, [autoAdvance, recording?.id, recording?.status]);
  // Note: only depend on stable values to avoid re-triggering

  if (!recording) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.notFoundText}>Recording not found</Text>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isProcessing =
    recording.status === 'transcribing' || recording.status === 'formatting';

  const handleTranscribe = async () => {
    setActionError(null);
    try {
      await updateRecording(id, { status: 'transcribing' });
      const { transcription: rawTranscription, uncertainTerms } =
        await transcribeRecording(recording.localUri);
      await updateRecording(id, { status: 'transcribed', rawTranscription, uncertainTerms });
      if (uncertainTerms.length > 0) {
        setPendingTerms(uncertainTerms);
        setPendingFormatType(selectedFormat);
        setShowValidationModal(true);
      }
    } catch (err: any) {
      await updateRecording(id, { status: 'pending' });
      setActionError(err.message || 'Transcription failed. Please try again.');
    }
  };

  const handleFormat = async (
    formatType: FormatType,
    confirmedTerms?: Array<{ original_term: string; corrected_term: string }>
  ) => {
    setShowFormatPicker(false);
    setActionError(null);
    try {
      await updateRecording(id, { status: 'formatting', formatType });

      let currentTags: string[] = [];
      if (autotaggingEnabled) {
        let tagList = tags;
        if (tagList.length === 0) {
          await fetchTags();
          tagList = tags;
        }
        currentTags = tagList.map((t) => t.name);
      }

      const existingTerms = await loadValidatedTerms();
      // Merge confirmed terms with existing (confirmed take precedence via upsert)
      const allValidatedTerms = confirmedTerms
        ? [...existingTerms.filter(
            (e) => !confirmedTerms.some((c) => c.original_term === e.original_term)
          ), ...confirmedTerms]
        : existingTerms;

      const result = await formatTranscription(
        recording.rawTranscription!,
        formatType,
        customExample || undefined,
        reformatInstructions || undefined,
        autotaggingEnabled,
        currentTags,
        allValidatedTerms
      );

      await updateRecording(id, {
        status: 'formatted',
        formattedTitle: result.title,
        formattedText: result.formatted_text,
        suggestedTags: result.suggested_tags,
      });
    } catch (err: any) {
      await updateRecording(id, { status: 'transcribed' });
      setActionError(err.message || 'Formatting failed. Please try again.');
    }
  };

  const handleValidationConfirm = async (
    validated: Array<{ original_term: string; corrected_term: string }>
  ) => {
    setShowValidationModal(false);
    setPendingTerms([]);
    // Persist the validated terms for future use
    try {
      await saveValidatedTerms(validated);
    } catch {
      // Non-fatal: continue even if persistence fails
    }
    // Proceed with formatting using the confirmed corrections
    const fmt = pendingFormatType ?? selectedFormat;
    setPendingFormatType(null);
    await handleFormat(fmt, validated);
  };

  const handleValidationSkip = () => {
    setShowValidationModal(false);
    setPendingTerms([]);
    const fmt = pendingFormatType ?? selectedFormat;
    setPendingFormatType(null);
    handleFormat(fmt);
  };

  const handleSaveAsNote = async () => {
    if (!recording.formattedText || !recording.formattedTitle) return;
    setSaving(true);
    try {
      const note = await createNote({
        title: recording.formattedTitle,
        formatted_text: recording.formattedText,
        raw_transcription: recording.rawTranscription ?? '',
        format_type: recording.formatType ?? selectedFormat,
        audio_uri: recording.localUri,
      });

      // Apply suggested tags
      if (note && recording.suggestedTags && recording.suggestedTags.length > 0) {
        const tagMap = new Map(tags.map((t) => [t.name, t.id]));
        for (const tagName of recording.suggestedTags) {
          const tagId = tagMap.get(tagName);
          if (tagId) {
            try { await addTagToNote(note.id, tagId); } catch { /* non-fatal */ }
          }
        }
      }

      await updateRecording(id, { status: 'saved', noteId: note.id });
    } catch (err: any) {
      showAlert('Save Failed', err.message || 'Could not save the note.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    showConfirm(
      'Delete Recording',
      'This will permanently delete the audio file. Any saved note will remain.',
      async () => {
        await deleteRecording(id);
        router.back();
      }
    );
  };

  const handleRetranscribe = () => {
    showConfirm(
      'Re-transcribe',
      'This will replace the existing transcript and formatted note. Continue?',
      async () => {
        await updateRecording(id, { status: 'pending', rawTranscription: undefined, formattedText: undefined, formattedTitle: undefined });
        handleTranscribe();
      }
    );
  };

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  const formatRelativeDate = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(iso).toLocaleDateString();
  };

  return (
    <SafeAreaView style={styles.container}>
      <AcronymValidationModal
        visible={showValidationModal}
        terms={pendingTerms}
        onConfirm={handleValidationConfirm}
        onSkip={handleValidationSkip}
      />
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.topButton}>
          <Text style={styles.topButtonText}>← Back</Text>
        </Pressable>
        <Text style={styles.topTitle}>{formatRelativeDate(recording.createdAt)}</Text>
        <Pressable onPress={handleDelete} style={styles.deleteButton} accessibilityLabel="Delete recording">
          <Text style={styles.deleteIconText}>🗑</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <AudioPlaybackBar localUri={recording.localUri} fileSizeBytes={recording.fileSizeBytes} />

        {/* Status */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[recording.status] + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[recording.status] }]} />
            <Text style={[styles.statusLabel, { color: STATUS_COLORS[recording.status] }]}>
              {STATUS_LABELS[recording.status]}
            </Text>
          </View>
          <Text style={styles.durationText}>{formatDuration(recording.duration)}</Text>
        </View>

        {/* Error */}
        {actionError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{actionError}</Text>
          </View>
        )}

        {/* Action section */}
        <View style={styles.actionSection}>
          {recording.status === 'pending' && (
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
              onPress={handleTranscribe}
            >
              <Text style={styles.primaryButtonText}>Transcribe</Text>
            </Pressable>
          )}

          {(recording.status === 'transcribing' || recording.status === 'formatting') && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.loadingText}>
                {recording.status === 'transcribing' ? 'Transcribing…' : 'Formatting…'}
              </Text>
            </View>
          )}

          {recording.status === 'transcribed' && (
            <>
              <Pressable
                style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
                onPress={() => setShowFormatPicker(true)}
              >
                <Text style={styles.primaryButtonText}>Format…</Text>
              </Pressable>
            </>
          )}

          {(recording.status === 'formatted' || recording.status === 'saved') && (
            <>
              {recording.status === 'formatted' && (
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    saving && styles.buttonDisabled,
                    pressed && !saving && styles.buttonPressed,
                  ]}
                  onPress={handleSaveAsNote}
                  disabled={saving}
                >
                  <Text style={styles.primaryButtonText}>
                    {saving ? 'Saving…' : 'Save as Note'}
                  </Text>
                </Pressable>
              )}

              {recording.status === 'saved' && recording.noteId && (
                <Pressable
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
                  onPress={() => router.push(`/note/${recording.noteId}`)}
                >
                  <Text style={styles.primaryButtonText}>View Note</Text>
                </Pressable>
              )}

              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
                onPress={() => setShowFormatPicker(true)}
              >
                <Text style={styles.secondaryButtonText}>Reformat</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
                onPress={handleRetranscribe}
              >
                <Text style={styles.secondaryButtonText}>Re-transcribe</Text>
              </Pressable>
            </>
          )}

          {recording.status === 'transcribed' && (
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
              onPress={handleRetranscribe}
            >
              <Text style={styles.secondaryButtonText}>Re-transcribe</Text>
            </Pressable>
          )}
        </View>

        {/* Format picker (inline) */}
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
            {FORMAT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={({ pressed }) => [
                  styles.formatOption,
                  selectedFormat === opt.value && styles.formatOptionSelected,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => {
                  setSelectedFormat(opt.value);
                  handleFormat(opt.value);
                }}
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
          </View>
        )}

        {/* Raw transcript */}
        {(recording.rawTranscription) && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Raw Transcript</Text>
            <Text style={styles.rawText}>{recording.rawTranscription}</Text>
          </View>
        )}

        {/* Formatted preview */}
        {(recording.formattedText) && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Formatted Preview</Text>
            {recording.formattedTitle && (
              <Text style={styles.formattedTitle}>{recording.formattedTitle}</Text>
            )}
            <Markdown style={markdownStyles}>{recording.formattedText}</Markdown>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const markdownStyles = {
  body: { fontSize: 15, color: Colors.text, lineHeight: 24 },
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  topButton: { padding: 4, minWidth: 60 },
  topButtonText: { color: Colors.primary, fontSize: 15, fontWeight: '500' },
  topTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  deleteButton: { padding: 8, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  deleteIconText: { fontSize: 22 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  statusRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 13, fontWeight: '600' },
  durationText: { fontSize: 13, color: Colors.textTertiary, fontWeight: '500' },
  errorBanner: {
    backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12,
    marginBottom: 16, borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { color: '#DC2626', fontSize: 14, textAlign: 'center' },
  actionSection: { marginBottom: 24, gap: 12 },
  primaryButton: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  secondaryButtonText: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  buttonPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  buttonDisabled: { opacity: 0.5 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', paddingVertical: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '500' },
  formatPicker: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: Colors.borderLight,
  },
  formatPickerTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  formatOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10,
  },
  formatOptionSelected: { backgroundColor: Colors.primarySubtle },
  formatOptionIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  formatOptionLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  formatOptionDesc: { fontSize: 12, color: Colors.textTertiary },
  formatInstructionsLabel: {
    fontSize: 12, fontWeight: '600', color: Colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 12, marginBottom: 6,
  },
  formatInstructionsInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    padding: 10, fontSize: 14, color: Colors.text,
    minHeight: 60, backgroundColor: Colors.background,
  },
  formatCancelButton: { marginTop: 8, paddingVertical: 8, alignItems: 'center' },
  formatCancelText: { color: Colors.textSecondary, fontSize: 14 },
  section: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: Colors.borderLight,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },
  rawText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22, fontStyle: 'italic' },
  formattedTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFoundText: { fontSize: 16, color: Colors.textSecondary, marginBottom: 16 },
  backButton: { paddingHorizontal: 20, paddingVertical: 10 },
  backButtonText: { color: Colors.primary, fontSize: 15 },
});
