import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { Colors } from '../constants/colors';
import { AdminUser } from '../types';

interface MemberRowProps {
  user: AdminUser;
  onChangeRole: (
    userId: string,
    tier: 'free' | 'unlimited',
    isAdmin: boolean
  ) => void;
}

type RoleOption = {
  label: string;
  description: string;
  tier: 'free' | 'unlimited';
  isAdmin: boolean;
  current: boolean;
};

function getRoleOptions(user: AdminUser): RoleOption[] {
  return [
    {
      label: 'Free',
      description: '5 notes/day',
      tier: 'free',
      isAdmin: false,
      current: !user.is_admin && user.tier === 'free',
    },
    {
      label: 'Unlimited',
      description: 'Unlimited notes, no admin access',
      tier: 'unlimited',
      isAdmin: false,
      current: !user.is_admin && user.tier === 'unlimited',
    },
    {
      label: 'Admin',
      description: 'Unlimited notes + admin dashboard',
      tier: 'unlimited',
      isAdmin: true,
      current: user.is_admin,
    },
  ];
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

function WebRolePicker({
  user,
  visible,
  onClose,
  onSelect,
}: {
  user: AdminUser;
  visible: boolean;
  onClose: () => void;
  onSelect: (tier: 'free' | 'unlimited', isAdmin: boolean) => void;
}) {
  const options = getRoleOptions(user);
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Manage Role</Text>
          <Text style={styles.sheetEmail}>{user.email}</Text>
          {options.map((opt) => (
            <Pressable
              key={opt.label}
              style={({ pressed }) => [
                styles.sheetOption,
                opt.current && styles.sheetOptionCurrent,
                pressed && !opt.current && { opacity: 0.7 },
              ]}
              onPress={() => {
                if (!opt.current) onSelect(opt.tier, opt.isAdmin);
                onClose();
              }}
            >
              <Text style={[styles.sheetOptionLabel, opt.current && styles.sheetOptionLabelCurrent]}>
                {opt.label}{opt.current ? '  ✓' : ''}
              </Text>
              <Text style={styles.sheetOptionDesc}>{opt.description}</Text>
            </Pressable>
          ))}
          <Pressable
            style={({ pressed }) => [styles.sheetCancel, pressed && { opacity: 0.7 }]}
            onPress={onClose}
          >
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

export default function MemberRow({ user, onChangeRole }: MemberRowProps) {
  const [webPickerVisible, setWebPickerVisible] = useState(false);

  const handleManage = () => {
    const options = getRoleOptions(user);

    if (Platform.OS === 'web') {
      setWebPickerVisible(true);
      return;
    }

    Alert.alert(
      'Manage Role',
      user.email,
      [
        ...options.map((opt) => ({
          text: opt.current ? `${opt.label} (current)` : opt.label,
          onPress: opt.current
            ? undefined
            : () => onChangeRole(user.user_id, opt.tier, opt.isAdmin),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
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

      {Platform.OS === 'web' && (
        <WebRolePicker
          user={user}
          visible={webPickerVisible}
          onClose={() => setWebPickerVisible(false)}
          onSelect={(tier, isAdmin) => onChangeRole(user.user_id, tier, isAdmin)}
        />
      )}
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    gap: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  sheetEmail: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginBottom: 12,
  },
  sheetOption: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    gap: 2,
  },
  sheetOptionCurrent: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySubtle,
  },
  sheetOptionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  sheetOptionLabelCurrent: {
    color: Colors.primary,
  },
  sheetOptionDesc: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  sheetCancel: {
    marginTop: 4,
    padding: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: Colors.surfaceHover,
  },
  sheetCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
