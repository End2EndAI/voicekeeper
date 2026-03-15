import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { showConfirm, showAlert } from '../utils/alert';
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
  const { defaultFormat, customExample, setDefaultFormat, setCustomExample } =
    usePreferences();

  const [localCustomExample, setLocalCustomExample] = useState(customExample);
  const [savingExample, setSavingExample] = useState(false);

  useEffect(() => {
    setLocalCustomExample(customExample);
  }, [customExample]);

  const handleSignOut = () => {
    showConfirm(
      'Sign Out',
      'Are you sure you want to sign out?',
      async () => {
        try {
          await signOut();
        } catch {
          showAlert('Error', 'Failed to sign out.');
        }
      }
    );
  };

  const handleFormatSelect = async (format: FormatType) => {
    try {
      await setDefaultFormat(format);
    } catch {
      showAlert('Error', 'Failed to update preference.');
    }
  };

  const handleSaveCustomExample = async () => {
    setSavingExample(true);
    try {
      await setCustomExample(localCustomExample);
      showAlert('Saved', 'Your custom template has been saved.');
    } catch {
      showAlert('Error', 'Failed to save custom template.');
    } finally {
      setSavingExample(false);
    }
  };

  const hasCustomExampleChanged = localCustomExample !== customExample;

  return (
    <SafeAreaView style={styles.container}>
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
        <Text style={styles.topTitle}>Settings</Text>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Format selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Default Format</Text>
          <Text style={styles.sectionDesc}>
            New recordings will use this format
          </Text>
          <View style={styles.formatList}>
            {FORMAT_OPTIONS.map((option) => {
              const isSelected = defaultFormat === option.value;
              const formatColors = Colors.format[option.value] || Colors.format.bullet_list;
              return (
                <Pressable
                  key={option.value}
                  style={({ pressed }) => [
                    styles.formatOption,
                    isSelected && {
                      borderColor: formatColors.text,
                      backgroundColor: formatColors.bg,
                    },
                    pressed && { transform: [{ scale: 0.98 }] },
                  ]}
                  onPress={() => handleFormatSelect(option.value)}
                  accessibilityLabel={`Select ${option.label} format`}
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={styles.formatHeader}>
                    <View
                      style={[
                        styles.formatIconCircle,
                        {
                          backgroundColor: isSelected
                            ? formatColors.text + '15'
                            : Colors.surfaceHover,
                        },
                      ]}
                    >
                      <Text style={styles.formatIcon}>{option.icon}</Text>
                    </View>
                    <View style={styles.formatTextContainer}>
                      <Text
                        style={[
                          styles.formatLabel,
                          isSelected && { color: formatColors.text },
                        ]}
                      >
                        {option.label}
                      </Text>
                      <Text style={styles.formatDesc}>{option.description}</Text>
                    </View>
                    {isSelected && (
                      <View
                        style={[
                          styles.checkCircle,
                          { backgroundColor: formatColors.text },
                        ]}
                      >
                        <Text style={styles.checkmark}>✓</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Custom template */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custom Template</Text>
          <Text style={styles.sectionDesc}>
            Paste an example note in your desired format. The AI will use it as
            a model when you choose "Custom".
          </Text>
          <TextInput
            style={styles.customExampleInput}
            value={localCustomExample}
            onChangeText={setLocalCustomExample}
            placeholder={`Example:\n\n## Summary\nBrief overview of the topic.\n\n## Key Points\n- First point\n- Second point\n\n## Next Steps\n1. Action one\n2. Action two`}
            placeholderTextColor={Colors.textTertiary}
            multiline
            textAlignVertical="top"
            accessibilityLabel="Custom template example"
          />
          <Pressable
            style={({ pressed }) => [
              styles.saveExampleButton,
              (!hasCustomExampleChanged || savingExample) &&
                styles.saveExampleButtonDisabled,
              pressed &&
                hasCustomExampleChanged &&
                !savingExample && { opacity: 0.85 },
            ]}
            onPress={handleSaveCustomExample}
            disabled={!hasCustomExampleChanged || savingExample}
          >
            <Text style={styles.saveExampleButtonText}>
              {savingExample ? 'Saving...' : 'Save Template'}
            </Text>
          </Pressable>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.accountCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {user?.email?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
            <View style={styles.accountTextContainer}>
              <Text style={styles.emailLabel}>Signed in as</Text>
              <Text style={styles.email}>{user?.email}</Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>

        {/* App info */}
        <View style={styles.footer}>
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
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  section: {
    marginBottom: 36,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  sectionDesc: {
    fontSize: 14,
    color: Colors.textTertiary,
    marginBottom: 18,
    lineHeight: 20,
  },
  formatList: {
    gap: 10,
  },
  formatOption: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.borderLight,
  },
  formatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  formatIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  formatIcon: {
    fontSize: 18,
  },
  formatTextContainer: {
    flex: 1,
  },
  formatLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  formatDesc: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  checkmark: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  customExampleInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: Colors.surface,
    minHeight: 180,
    lineHeight: 22,
    fontFamily: 'monospace',
  },
  saveExampleButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
    ...Colors.shadow.sm,
  },
  saveExampleButtonDisabled: {
    opacity: 0.4,
  },
  saveExampleButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  accountCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    ...Colors.shadow.sm,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primarySubtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  accountTextContainer: {
    flex: 1,
  },
  emailLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginBottom: 2,
    fontWeight: '500',
  },
  email: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
  },
  signOutButton: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.error,
  },
  signOutText: {
    color: Colors.error,
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 16,
  },
  appInfo: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  appTagline: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginTop: 4,
  },
});
