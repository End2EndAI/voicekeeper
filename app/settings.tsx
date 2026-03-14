import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { FORMAT_OPTIONS } from '../constants/formats';
import { Colors } from '../constants/colors';
import { FormatType } from '../types';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { defaultFormat, setDefaultFormat } = usePreferences();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch {
            Alert.alert('Error', 'Failed to sign out.');
          }
        },
      },
    ]);
  };

  const handleFormatSelect = async (format: FormatType) => {
    try {
      await setDefaultFormat(format);
    } catch {
      Alert.alert('Error', 'Failed to update preference.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backPressable}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.topTitle}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Default Format</Text>
          <Text style={styles.sectionDesc}>
            New recordings will use this format by default
          </Text>
          <View style={styles.formatList}>
            {FORMAT_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.formatOption,
                  defaultFormat === option.value && styles.formatOptionSelected,
                ]}
                onPress={() => handleFormatSelect(option.value)}
                accessibilityLabel={`Select ${option.label} format`}
                accessibilityState={{
                  selected: defaultFormat === option.value,
                }}
              >
                <View style={styles.formatHeader}>
                  <Text style={styles.formatIcon}>{option.icon}</Text>
                  <Text
                    style={[
                      styles.formatLabel,
                      defaultFormat === option.value &&
                        styles.formatLabelSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {defaultFormat === option.value && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </View>
                <Text style={styles.formatDesc}>{option.description}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.accountInfo}>
            <Text style={styles.emailLabel}>Signed in as</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
          <Pressable style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.appInfo}>VoiceKeeper v1.0.0</Text>
          <Text style={styles.appTagline}>Speak it. Keep it. Organized.</Text>
        </View>
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backPressable: {
    padding: 4,
    minWidth: 60,
  },
  backText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  topTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  formatList: {
    gap: 10,
  },
  formatOption: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  formatOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#F5F3FF',
  },
  formatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  formatIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  formatLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  formatLabelSelected: {
    color: Colors.primary,
  },
  checkmark: {
    fontSize: 18,
    color: Colors.primary,
    fontWeight: '700',
  },
  formatDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 28,
  },
  accountInfo: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  emailLabel: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
  },
  signOutButton: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.error,
  },
  signOutText: {
    color: Colors.error,
    fontSize: 16,
    fontWeight: '600',
  },
  appInfo: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  appTagline: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 4,
  },
});
