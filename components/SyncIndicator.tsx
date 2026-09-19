import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/colors';
import { SyncState } from '../types';

interface SyncIndicatorProps {
  state: SyncState;
  onPress?: () => void;
}

function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * One-line status for the offline cache: whether the device is behind, how many
 * changes are still waiting to reach the server, and when the last successful
 * sync happened. Tapping it forces a sync.
 *
 * Renders nothing in the steady state — everything synced and nothing pending —
 * so the header stays quiet when there is nothing to say.
 */
export const SyncIndicator: React.FC<SyncIndicatorProps> = ({ state, onPress }) => {
  const { syncing, offline, pending, lastSyncAt, lastError } = state;

  if (!syncing && !offline && pending === 0 && !lastError) return null;

  let label: string;
  let warn = false;

  if (syncing) {
    label = 'Syncing…';
  } else if (offline) {
    label =
      pending > 0
        ? `Offline · ${pending} change${pending !== 1 ? 's' : ''} pending`
        : 'Offline · showing saved notes';
    warn = true;
  } else if (pending > 0) {
    label = `${pending} change${pending !== 1 ? 's' : ''} to sync`;
    warn = true;
  } else {
    label = 'Some changes could not be saved · tap to retry';
    warn = true;
  }

  if (!offline && !syncing && lastSyncAt) {
    label += ` · last sync ${relativeTime(lastSyncAt)}`;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={syncing || !onPress}
      accessibilityLabel={`Sync status: ${label}`}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
    >
      {syncing ? (
        <ActivityIndicator size="small" color={Colors.textTertiary} />
      ) : (
        <View style={[styles.dot, warn && styles.dotWarning]} />
      )}
      <Text style={[styles.label, warn ? styles.labelWarning : styles.labelNeutral]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textTertiary,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
  },
  dotWarning: {
    backgroundColor: Colors.warning,
  },
  labelNeutral: {
    color: Colors.textTertiary,
  },
  labelWarning: {
    color: Colors.warning,
  },
});
