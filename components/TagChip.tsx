import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Tag } from '../types';
import { Colors } from '../constants/colors';

interface TagChipProps {
  tag: Tag;
  onRemove?: () => void;
  size?: 'small' | 'medium';
}

export const TagChip: React.FC<TagChipProps> = ({
  tag,
  onRemove,
  size = 'medium',
}) => {
  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.chip,
        isSmall && styles.chipSmall,
        { backgroundColor: tag.color + '20', borderColor: tag.color + '50' },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: tag.color }]} />
      <Text
        style={[
          styles.label,
          isSmall && styles.labelSmall,
          { color: tag.color },
        ]}
        numberOfLines={1}
      >
        {tag.name}
      </Text>
      {onRemove && (
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          style={({ pressed }) => [
            styles.removeButton,
            pressed && { opacity: 0.6 },
          ]}
          accessibilityLabel={`Remove tag ${tag.name}`}
        >
          <Text style={[styles.removeText, { color: tag.color }]}>×</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
    alignSelf: 'flex-start',
  },
  chipSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 120,
  },
  labelSmall: {
    fontSize: 11,
  },
  removeButton: {
    marginLeft: 2,
  },
  removeText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 16,
  },
});
