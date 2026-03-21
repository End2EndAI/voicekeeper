import React from 'react';
import { ScrollView, Pressable, Text, View, StyleSheet } from 'react-native';
import { Tag } from '../types';
import { Colors } from '../constants/colors';

interface TagFilterBarProps {
  tags: Tag[];
  selectedTagId: string | null;
  onSelect: (tagId: string | null) => void;
}

export const TagFilterBar: React.FC<TagFilterBarProps> = ({
  tags,
  selectedTagId,
  onSelect,
}) => {
  if (tags.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={styles.scroll}
    >
      <Pressable
        style={({ pressed }) => [
          styles.chip,
          selectedTagId === null && styles.chipAll,
          pressed && { opacity: 0.75 },
        ]}
        onPress={() => onSelect(null)}
      >
        <Text
          style={[
            styles.chipText,
            selectedTagId === null && styles.chipTextAll,
          ]}
        >
          All
        </Text>
      </Pressable>

      {tags.map((tag) => {
        const isSelected = selectedTagId === tag.id;
        return (
          <Pressable
            key={tag.id}
            style={({ pressed }) => [
              styles.chip,
              isSelected && {
                backgroundColor: tag.color + '20',
                borderColor: tag.color + '60',
              },
              pressed && { opacity: 0.75 },
            ]}
            onPress={() => onSelect(isSelected ? null : tag.id)}
          >
            <View style={[styles.dot, { backgroundColor: tag.color }]} />
            <Text
              style={[
                styles.chipText,
                isSelected && { color: tag.color, fontWeight: '700' },
              ]}
            >
              {tag.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipAll: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  chipTextAll: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
