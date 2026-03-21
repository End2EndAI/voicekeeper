import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        await signUp(email.trim(), password);
        setConfirmationEmail(email.trim());
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToSignIn = () => {
    setConfirmationEmail(null);
    setIsSignUp(false);
    setEmail('');
    setPassword('');
    setError(null);
  };

  if (confirmationEmail) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Branding */}
          <View style={styles.brand}>
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <View style={styles.micBody} />
                <View style={styles.micBase} />
              </View>
            </View>
            <Text style={styles.appName}>VoiceKeeper</Text>
            <Text style={styles.tagline}>Speak it. Keep it. Organized.</Text>
          </View>

          {/* Confirmation card */}
          <View style={styles.card}>
            <View style={styles.confirmationIconContainer}>
              <Text style={styles.confirmationIcon}>✉</Text>
            </View>
            <Text style={styles.confirmationTitle}>Check your inbox</Text>
            <Text style={styles.confirmationSubtitle}>
              A confirmation email has been sent to:
            </Text>
            <Text style={styles.confirmationEmail}>{confirmationEmail}</Text>
            <Text style={styles.confirmationHint}>
              Click the link in the email to activate your account, then come back to sign in.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleBackToSignIn}
              accessibilityRole="button"
              accessibilityLabel="Back to sign in"
            >
              <Text style={styles.buttonText}>Back to Sign In</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Branding */}
        <View style={styles.brand}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <View style={styles.micBody} />
              <View style={styles.micBase} />
            </View>
          </View>
          <Text style={styles.appName}>VoiceKeeper</Text>
          <Text style={styles.tagline}>Speak it. Keep it. Organized.</Text>
        </View>

        {/* Form card */}
        <View style={styles.card}>
          <Text style={styles.title}>
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </Text>
          <Text style={styles.subtitle}>
            {isSignUp
              ? 'Start capturing your voice notes'
              : 'Sign in to access your notes'}
          </Text>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (error) setError(null);
              }}
              placeholder="you@example.com"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              editable={!loading}
              accessibilityLabel="Email address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (error) setError(null);
              }}
              placeholder="At least 6 characters"
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry
              autoComplete="password"
              editable={!loading}
              accessibilityLabel="Password"
              onSubmitEditing={handleSubmit}
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              loading && styles.buttonDisabled,
              pressed && !loading && styles.buttonPressed,
            ]}
            onPress={handleSubmit}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={isSignUp ? 'Sign up' : 'Sign in'}
          >
            <Text style={styles.buttonText}>
              {loading
                ? 'Please wait...'
                : isSignUp
                ? 'Create Account'
                : 'Sign In'}
            </Text>
          </Pressable>
        </View>

        {/* Toggle */}
        <Pressable
          onPress={() => {
            setIsSignUp(!isSignUp);
            setError(null);
          }}
          style={styles.switchButton}
          disabled={loading}
        >
          <Text style={styles.switchText}>
            {isSignUp
              ? 'Already have an account? '
              : "Don't have an account? "}
            <Text style={styles.switchTextBold}>
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingBottom: 48,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Colors.shadow.lg,
    shadowColor: Colors.primary,
  },
  micBody: {
    width: 16,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  micBase: {
    width: 24,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
    marginTop: 4,
  },
  appName: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.8,
  },
  tagline: {
    fontSize: 15,
    color: Colors.textTertiary,
    marginTop: 6,
    letterSpacing: 0.2,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 28,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
    ...Colors.shadow.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textTertiary,
    marginBottom: 24,
  },
  errorContainer: {
    backgroundColor: Colors.errorLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    ...Colors.shadow.md,
    shadowColor: Colors.primary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  switchButton: {
    alignItems: 'center',
    marginTop: 24,
    padding: 8,
  },
  switchText: {
    color: Colors.textTertiary,
    fontSize: 14,
  },
  switchTextBold: {
    color: Colors.primary,
    fontWeight: '600',
  },
  confirmationIconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmationIcon: {
    fontSize: 48,
  },
  confirmationTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  confirmationSubtitle: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  confirmationEmail: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  confirmationHint: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
});
