import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors } from '../constants/colors';
import { showConfirm } from '../utils/alert';
import { AdminUser } from '../types';

interface MemberRowProps {
  user: AdminUser;
  onChangeRole: (
    userId: string,
    tier: 'free' | 'unlimited',
    isAdmin: boolean
  ) => void;
}

function RoleBadge({ tier, isAdmin }: { tier: 'free' | 'unlimited'; isAdmin: boolean }) {
  if (isAdmin) {
    return (
      <View style={[styles.badge, styles.badgeAdmin]}>
        <Text style={[styles.badgeText, styles.badgeTextAdmin]}>Admin</Text>
      </View>
    );
  }
  if (tier === 'unlimited') {
    return (
      <View style={[styles.badge, styles.badgeUnlimited]}>
        <Text style={[styles.badgeText, styles.badgeTextUnlimited]}>Unlimited</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, styles.badgeFree]}>
      <Text style={[styles.badgeText, styles.badgeTextFree]}>Free</Text>
    </View>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function truncateEmail(email: string, maxLength = 28): string {
  if (email.length <= maxLength) return email;
  const atIndex = email.indexOf('@');
  if (atIndex === -1) return email.slice(0, maxLength) + '…';
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);
  if (local.length + domain.length <= maxLength) return email;
  const allowedLocal = maxLength - domain.length - 1;
  return local.slice(0, Math.max(allowedLocal, 3)) + '…' + domain;
}

export default function MemberRow({ user, onChangeRole }: MemberRowProps) {
  const handleManage = () => {
    const options: { label: string; tier: 'free' | 'unlimited'; isAdmin: boolean }[] = [
      { label: 'Set Free', tier: 'free', isAdmin: false },
      { label: 'Set Unlimited', tier: 'unlimited', isAdmin: false },
      { label: 'Set Admin', tier: 'unlimited', isAdmin: true },
    ];

    if (user.is_admin) {
      options.push({ label: 'Remove Admin', tier: user.tier, isAdmin: false });
    }

    // Build a readable summary of the actions for the confirm dialog
    const optionLabels = options.map((o, i) => `${i + 1}. ${o.label}`).join('\n');

    showConfirm(
      'Manage Role',
      `User: ${user.email}\n\nAvailable actions:\n${optionLabels}\n\nSelect "OK" to cycle to the next role, or "Cancel" to dismiss.`,
      () => {
        // Cycle through roles: free → unlimited → admin → free
        if (!user.is_admin && user.tier === 'free') {
          onChangeRole(user.user_id, 'unlimited', false);
        } else if (!user.is_admin && user.tier === 'unlimited') {
          onChangeRole(user.user_id, 'unlimited', true);
        } else {
          onChangeRole(user.user_id, 'free', false);
        }
      }
    );
  };

  return (
    <View style={styles.row}>
      <View style={styles.mainInfo}>
        <View style={styles.headerRow}>
          <Text style={styles.email} numberOfLines={1}>
            {truncateEmail(user.email)}
          </Text>
          <RoleBadge tier={user.tier} isAdmin={user.is_admin} />
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statText}>
            {user.note_count_30d} notes (30d)
          </Text>
          <Text style={styles.statSeparator}>·</Text>
          <Text style={styles.statText}>{user.note_count_total} total</Text>
          <Text style={styles.statSeparator}>·</Text>
          <Text style={styles.statText}>Joined {formatDate(user.created_at)}</Text>
        </View>
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.manageButton,
          pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] },
        ]}
        onPress={handleManage}
        accessibilityLabel={`Manage role for ${user.email}`}
      >
        <Text style={styles.manageButtonText}>Manage</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    ...Colors.shadow.sm,
  },
  mainInfo: {
    flex: 1,
    marginRight: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  email: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeAdmin: {
    backgroundColor: '#FEE2E2',
  },
  badgeUnlimited: {
    backgroundColor: '#F3E8FF',
  },
  badgeFree: {
    backgroundColor: Colors.surfaceHover,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextAdmin: {
    color: '#DC2626',
  },
  badgeTextUnlimited: {
    color: '#7C3AED',
  },
  badgeTextFree: {
    color: Colors.textTertiary,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  statSeparator: {
    fontSize: 12,
    color: Colors.borderLight,
  },
  manageButton: {
    backgroundColor: Colors.primarySubtle,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  manageButtonText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});
