import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Note } from '../types';
import { TagChip } from './TagChip';
import { Colors } from '../constants/colors';
import { formatDate, truncateText } from '../utils/titleGenerator';
import { useTags } from '../contexts/TagsContext';

interface NoteCardProps {
  note: Note;
  onPress: (note: Note) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, onPress }) => {
  const { noteTagsMap } = useTags();
  const noteTags = (noteTagsMap[note.id] ?? []).slice(0, 3);
  const [copied, setCopied] = useState(false);

  const handleLongPress = async () => {
    const text = note.title ? `${note.title}\n\n${note.formatted_text}` : note.formatted_text;
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, copied && styles.cardCopied]}
      onPress={() => onPress(note)}
      onLongPress={handleLongPress}
      delayLongPress={500}
      accessibilityRole="button"
      accessibilityLabel={`Note: ${note.title}`}
    >
      <View style={styles.header}>
        {noteTags.length > 0 && (
          <View style={styles.tagsRow}>
            {noteTags.map((tag) => (
              <TagChip key={tag.id} tag={tag} size="small" />
            ))}
          </View>
        )}
        <Text style={styles.date}>{formatDate(note.created_at)}</Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {note.title}
      </Text>
      <Text style={styles.preview} numberOfLines={3}>
        {truncateText(note.formatted_text, 180)}
      </Text>
      {copied && (
        <View style={styles.copiedBadge}>
          <Text style={styles.copiedText}>Copied!</Text>
        </View>
      )}
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
  cardCopied: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  copiedBadge: {
    position: 'absolute',
    top: 10,
    right: 12,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  copiedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
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
    flexShrink: 0,
    marginLeft: 'auto',
  },
});
