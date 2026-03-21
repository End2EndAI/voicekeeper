import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { showAlert } from '../../utils/alert';
import { getAdminUsers, setUserRole } from '../../services/admin';
import MemberRow from '../../components/MemberRow';
import { AdminUser } from '../../types';

interface GlobalStats {
  totalUsers: number;
  activeUsers30d: number;
  totalNotes30d: number;
}

function computeStats(users: AdminUser[]): GlobalStats {
  return {
    totalUsers: users.length,
    activeUsers30d: users.filter((u) => u.note_count_30d > 0).length,
    totalNotes30d: users.reduce((sum, u) => sum + u.note_count_30d, 0),
  };
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<GlobalStats>({
    totalUsers: 0,
    activeUsers30d: 0,
    totalNotes30d: 0,
  });

  const loadUsers = useCallback(async () => {
    try {
      const data = await getAdminUsers();
      setUsers(data);
      setStats(computeStats(data));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not load users.';
      showAlert('Error', message);
    }
  }, []);

  useEffect(() => {
    loadUsers().finally(() => setLoading(false));
  }, [loadUsers]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  }, [loadUsers]);

  const handleChangeRole = useCallback(
    async (userId: string, tier: 'free' | 'unlimited', isAdmin: boolean) => {
      try {
        await setUserRole(userId, tier, isAdmin);
        // Optimistic update
        setUsers((prev) =>
          prev.map((u) =>
            u.user_id === userId ? { ...u, tier, is_admin: isAdmin } : u
          )
        );
        setStats((prev) => {
          const updated = users.map((u) =>
            u.user_id === userId ? { ...u, tier, is_admin: isAdmin } : u
          );
          return computeStats(updated);
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Could not update role.';
        showAlert('Error', message);
      }
    },
    [users]
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backPressable,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.topTitle}>Admin Dashboard</Text>
        <View style={{ width: 56 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
          ListHeaderComponent={
            <>
              {/* Global stats */}
              <View style={styles.statsContainer}>
                <StatCard label="Total Users" value={stats.totalUsers} />
                <StatCard label="Active (30d)" value={stats.activeUsers30d} />
                <StatCard label="Notes (30d)" value={stats.totalNotes30d} />
              </View>

              <Text style={styles.sectionTitle}>Members</Text>
            </>
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No users found.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <MemberRow user={item} onChangeRole={handleChangeRole} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backPressable: {
    paddingVertical: 4,
    minWidth: 56,
  },
  backText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  topTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textTertiary,
  },
  listContent: {
    padding: 20,
    paddingBottom: 48,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    ...Colors.shadow.sm,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 14,
    letterSpacing: -0.2,
  },
});
