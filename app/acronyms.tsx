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
import {
  ValidatedTerm,
  loadValidatedTerms,
  deleteValidatedTerm,
  deleteAllValidatedTerms,
} from '../services/validatedTerms';
import { showConfirm, showAlert } from '../utils/alert';

export default function AcronymsScreen() {
  const router = useRouter();
  const [terms, setTerms] = useState<ValidatedTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await loadValidatedTerms();
      setTerms(data);
    } catch {
      showAlert('Error', 'Could not load saved terms.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = (term: ValidatedTerm) => {
    showConfirm(
      'Remove term',
      `Remove "${term.original_term}" → "${term.corrected_term}"? It will no longer be used in future transcriptions.`,
      async () => {
        setDeleting(term.original_term);
        try {
          await deleteValidatedTerm(term.original_term);
          setTerms((prev) => prev.filter((t) => t.original_term !== term.original_term));
        } catch {
          showAlert('Error', 'Could not remove the term.');
        } finally {
          setDeleting(null);
        }
      }
    );
  };

  const handleClearAll = () => {
    if (terms.length === 0) return;
    showConfirm(
      'Clear all terms',
      'Remove all saved corrections? This cannot be undone.',
      async () => {
        try {
          await deleteAllValidatedTerms();
          setTerms([]);
        } catch {
          showAlert('Error', 'Could not clear terms.');
        }
      }
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backPressable, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.topTitle}>Saved Terms</Text>
        {terms.length > 0 ? (
          <Pressable
            onPress={handleClearAll}
            style={({ pressed }) => [styles.clearPressable, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.clearText}>Clear all</Text>
          </Pressable>
        ) : (
          <View style={{ width: 72 }} />
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : terms.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🔤</Text>
          <Text style={styles.emptyTitle}>No saved corrections</Text>
          <Text style={styles.emptyDesc}>
            When the AI flags uncertain terms during transcription and you confirm the correct
            spelling, those corrections are saved here and reused automatically in future notes.
          </Text>
        </View>
      ) : (
        <FlatList
          data={terms}
          keyExtractor={(item) => item.original_term}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Text style={styles.listHeader}>
              {terms.length} saved {terms.length === 1 ? 'correction' : 'corrections'}
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.termRow}>
              <View style={styles.termTexts}>
                <View style={styles.termPair}>
                  <Text style={styles.originalText}>{item.original_term}</Text>
                  <Text style={styles.arrow}>→</Text>
                  <Text style={styles.correctedText}>{item.corrected_term}</Text>
                </View>
              </View>
              <Pressable
                onPress={() => handleDelete(item)}
                disabled={deleting === item.original_term}
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed && { opacity: 0.6 },
                  deleting === item.original_term && { opacity: 0.4 },
                ]}
                accessibilityLabel={`Remove correction for ${item.original_term}`}
              >
                <Text style={styles.deleteText}>Remove</Text>
              </Pressable>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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
  clearPressable: {
    paddingVertical: 4,
    minWidth: 72,
    alignItems: 'flex-end',
  },
  clearText: {
    color: Colors.error,
    fontSize: 15,
    fontWeight: '500',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
  },
  listContent: {
    padding: 20,
    paddingBottom: 48,
  },
  listHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 16,
  },
  termRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  termTexts: {
    flex: 1,
  },
  termPair: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  originalText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  arrow: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
  correctedText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Colors.errorLight,
    marginLeft: 12,
  },
  deleteText: {
    fontSize: 12,
    color: Colors.error,
    fontWeight: '600',
  },
  separator: {
    height: 8,
  },
});
