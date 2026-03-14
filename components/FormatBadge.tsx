import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FormatType } from '../types';
import { FORMAT_LABELS } from '../constants/formats';
import { Colors } from '../constants/colors';

interface FormatBadgeProps {
  formatType: FormatType;
  size?: 'small' | 'medium';
}

export const FormatBadge: React.FC<FormatBadgeProps> = ({
  formatType,
  size = 'small',
}) => {
  const colors = Colors.format[formatType] || Colors.format.bullet_list;
  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: colors.bg },
        isSmall ? styles.badgeSmall : styles.badgeMedium,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: colors.text },
          isSmall ? styles.textSmall : styles.textMedium,
        ]}
      >
        {FORMAT_LABELS[formatType]}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeMedium: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  text: {
    fontWeight: '600',
  },
  textSmall: {
    fontSize: 11,
  },
  textMedium: {
    fontSize: 13,
  },
});
