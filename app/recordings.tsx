import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRecordings } from '../contexts/RecordingsContext';
import { Colors } from '../constants/colors';
import { Recording, RecordingStatus } from '../types';

const STATUS_LABELS: Record<RecordingStatus, string> = {
  pending: 'Pending',
  transcribing: 'Transcribing…',
  transcribed: 'Transcribed',
  formatting: 'Formatting…',
  formatted: 'Formatted',
  saved: 'Saved',
  error: 'Error',
};

const STATUS_COLORS: Record<RecordingStatus, string> = {
  pending: Colors.textTertiary,
  transcribing: Colors.primary,
  transcribed: Colors.primary,
  formatting: Colors.warning,
  formatted: Colors.warning,
  saved: Colors.success ?? '#34C759',
  error: Colors.error,
};

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function RecordingRow({ recording, onPress, onDelete }: {
  recording: Recording;
  onPress: () => void;
  onDelete: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
    >
      <View style={styles.rowMain}>
        <Text style={styles.rowDate}>{formatDate(recording.createdAt)}</Text>
        <Text style={styles.rowDuration}>{formatDuration(recording.duration)}</Text>
      </View>
      <View style={styles.rowMeta}>
        <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[recording.status] }]} />
        <Text style={[styles.statusLabel, { color: STATUS_COLORS[recording.status] }]}>
          {STATUS_LABELS[recording.status]}
        </Text>
        <Pressable
          onPress={onDelete}
          style={({ pressed }) => [styles.deleteButton, pressed && { opacity: 0.6 }]}
          hitSlop={8}
        >
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

export default function RecordingsScreen() {
  const router = useRouter();
  const { recordings, deleteRecording } = useRecordings();

  const sorted = [...recordings].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backPressable, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Recordings</Text>
        <View style={styles.topBarRight}>
          <Text style={styles.countBadge}>
            {recordings.length > 0 ? `${recordings.length}` : ''}
          </Text>
        </View>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RecordingRow
            recording={item}
            onPress={() => router.push(`/recording/${item.id}`)}
            onDelete={() => deleteRecording(item.id)}
          />
        )}
        contentContainerStyle={sorted.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No recordings yet</Text>
            <Text style={styles.emptySubtitle}>
              Recordings appear here after you stop recording.
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backPressable: {
    paddingVertical: 4,
    minWidth: 50,
  },
  backText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  topBarRight: {
    minWidth: 50,
    alignItems: 'flex-end',
  },
  countBadge: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyContainer: {
    flex: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  row: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.background,
  },
  rowMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  rowDate: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text,
  },
  rowDuration: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontVariant: ['tabular-nums'],
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  deleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  deleteText: {
    fontSize: 13,
    color: Colors.error,
    fontWeight: '500',
  },
  separator: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginHorizontal: 20,
  },
});
