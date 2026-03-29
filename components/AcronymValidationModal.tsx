import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors } from '../constants/colors';
import { UncertainTerm } from '../types';

interface ValidatedEntry {
  original: string;
  corrected: string;
  skip: boolean;
}

interface Props {
  visible: boolean;
  terms: UncertainTerm[];
  onConfirm: (validated: Array<{ original_term: string; corrected_term: string }>) => void;
  onSkip: () => void;
}

export const AcronymValidationModal: React.FC<Props> = ({
  visible,
  terms,
  onConfirm,
  onSkip,
}) => {
  const [entries, setEntries] = useState<ValidatedEntry[]>([]);

  useEffect(() => {
    const seen = new Set<string>();
    setEntries(
      terms
        .filter((t) => {
          if (seen.has(t.original)) return false;
          seen.add(t.original);
          return true;
        })
        .map((t) => ({
          original: t.original,
          corrected: t.suggestion ?? t.original,
          skip: false,
        }))
    );
  }, [terms]);

  const updateCorrected = (index: number, value: string) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, corrected: value, skip: false } : e))
    );
  };

  const toggleSkip = (index: number) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, skip: !e.skip } : e))
    );
  };

  const handleConfirm = () => {
    const validated = entries
      .filter((e) => !e.skip && e.corrected.trim() && e.corrected.trim() !== e.original)
      .map((e) => ({ original_term: e.original, corrected_term: e.corrected.trim() }));
    onConfirm(validated);
  };

  if (terms.length === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Check these terms</Text>
          <Text style={styles.subtitle}>
            The transcription may have misrecognised these words. Correct them to
            improve this note and future ones.
          </Text>

          <ScrollView style={styles.termsList} showsVerticalScrollIndicator={false}>
            {entries.map((entry, i) => (
              <View key={entry.original} style={[styles.termRow, entry.skip && styles.termRowSkipped]}>
                <View style={styles.termHeader}>
                  <Text style={styles.originalLabel}>Heard as:</Text>
                  <Text style={styles.originalText}>"{entry.original}"</Text>
                  <Pressable onPress={() => toggleSkip(i)} style={styles.skipButton}>
                    <Text style={styles.skipText}>{entry.skip ? 'Undo skip' : 'Skip'}</Text>
                  </Pressable>
                </View>
                {!entry.skip && (
                  <TextInput
                    style={styles.correctedInput}
                    value={entry.corrected}
                    onChangeText={(v) => updateCorrected(i, v)}
                    placeholder="Correct spelling..."
                    placeholderTextColor={Colors.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                )}
              </View>
            ))}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.confirmButton, pressed && { opacity: 0.85 }]}
              onPress={handleConfirm}
            >
              <Text style={styles.confirmText}>Save & Continue</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.skipAllButton, pressed && { opacity: 0.7 }]}
              onPress={onSkip}
            >
              <Text style={styles.skipAllText}>Skip all</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderLight,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textTertiary,
    lineHeight: 20,
    marginBottom: 20,
  },
  termsList: {
    flexGrow: 0,
    marginBottom: 20,
  },
  termRow: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  termRowSkipped: {
    opacity: 0.5,
  },
  termHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  originalLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  originalText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    flex: 1,
  },
  skipButton: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: Colors.surfaceHover,
  },
  skipText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  correctedInput: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.background,
    fontWeight: '500',
  },
  actions: {
    gap: 10,
  },
  confirmButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  skipAllButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipAllText: {
    color: Colors.textTertiary,
    fontSize: 14,
    fontWeight: '500',
  },
});
