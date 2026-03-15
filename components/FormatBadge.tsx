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
          styles.icon,
          { color: colors.text },
          isSmall ? styles.iconSmall : styles.iconMedium,
        ]}
      >
        {colors.icon}
      </Text>
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
    borderRadius: 20,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeSmall: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    gap: 4,
  },
  badgeMedium: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    gap: 6,
  },
  icon: {
    fontWeight: '700',
  },
  iconSmall: {
    fontSize: 10,
  },
  iconMedium: {
    fontSize: 12,
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
