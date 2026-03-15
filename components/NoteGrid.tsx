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
        <View style={styles.emptyIconContainer}>
          <View style={styles.emptyMicBody} />
          <View style={styles.emptyMicBase} />
        </View>
        <Text style={styles.emptyTitle}>No notes yet</Text>
        <Text style={styles.emptyText}>
          Tap the record button below to{'\n'}create your first voice note
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
    padding: 20,
    paddingBottom: 120,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primarySubtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyMicBody: {
    width: 14,
    height: 22,
    borderRadius: 7,
    backgroundColor: Colors.primaryLight,
  },
  emptyMicBase: {
    width: 20,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.primaryLight,
    marginTop: 3,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
