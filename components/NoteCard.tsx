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
      <Text style={styles.preview} numberOfLines={3}>
        {truncateText(note.formatted_text, 180)}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    ...Colors.shadow.sm,
  },
  cardPressed: {
    backgroundColor: Colors.surfaceHover,
    transform: [{ scale: 0.98 }],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  preview: {
    fontSize: 14,
    color: Colors.textTertiary,
    lineHeight: 20,
  },
  date: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
});
