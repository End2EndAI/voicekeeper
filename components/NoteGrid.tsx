import React from 'react';
import {
  FlatList,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Note } from '../types';
import { NoteCard } from './NoteCard';
import { Colors } from '../constants/colors';

interface NoteGridProps {
  notes: Note[];
  loading: boolean;
  onNotePress: (note: Note) => void;
  onRefresh: () => void;
}

export const NoteGrid: React.FC<NoteGridProps> = ({
  notes,
  loading,
  onNotePress,
  onRefresh,
}) => {
  if (loading && notes.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (notes.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyIcon}>🎙️</Text>
        <Text style={styles.emptyTitle}>No notes yet</Text>
        <Text style={styles.emptyText}>
          Tap the record button to create your first voice note
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={notes}
      renderItem={({ item }) => (
        <NoteCard note={item} onPress={onNotePress} />
      )}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={onRefresh}
          tintColor={Colors.primary}
        />
      }
    />
  );
};

const styles = StyleSheet.create({
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});
