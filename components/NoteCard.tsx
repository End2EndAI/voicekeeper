import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Note } from '../types';
import { FormatBadge } from './FormatBadge';
import { Colors } from '../constants/colors';
import { formatDate, truncateText } from '../utils/titleGenerator';

interface NoteCardProps {
  note: Note;
  onPress: (note: Note) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, onPress }) => {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress(note)}
      accessibilityRole="button"
      accessibilityLabel={`Note: ${note.title}`}
    >
      <View style={styles.header}>
        <FormatBadge formatType={note.format_type} />
        <Text style={styles.date}>{formatDate(note.created_at)}</Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {note.title}
      </Text>
      <Text style={styles.preview} numberOfLines={4}>
        {truncateText(note.formatted_text, 200)}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardPressed: {
    backgroundColor: Colors.surfaceHover,
    transform: [{ scale: 0.98 }],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  preview: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  date: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
});
