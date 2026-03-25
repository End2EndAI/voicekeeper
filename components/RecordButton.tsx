import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Animated, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';

interface RecordButtonProps {
  onPress: () => void;
  onTextNotePress?: () => void;
}

export const RecordButton: React.FC<RecordButtonProps> = ({ onPress, onTextNotePress }) => {
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.25,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim, opacityAnim]);

  return (
    <View style={[styles.container, { bottom: 32 + insets.bottom }]}>
      {onTextNotePress && (
        <Pressable
          style={({ pressed }) => [
            styles.textNoteButton,
            pressed && styles.textNoteButtonPressed,
          ]}
          onPress={onTextNotePress}
          accessibilityRole="button"
          accessibilityLabel="Create a text note"
        >
          <Text style={styles.textNoteIcon}>T</Text>
        </Pressable>
      )}

      <View style={styles.recordWrapper}>
        <Animated.View
          style={[
            styles.pulseRing,
            {
              transform: [{ scale: pulseAnim }],
              opacity: opacityAnim,
            },
          ]}
        />
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel="Record a new voice note"
        >
          <View style={styles.micIcon}>
            <View style={styles.micBody} />
            <View style={styles.micBase} />
          </View>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    pointerEvents: 'box-none',
  } as any,
  recordWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.recording,
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.recording,
    justifyContent: 'center',
    alignItems: 'center',
    ...Colors.shadow.lg,
    shadowColor: Colors.recording,
  },
  buttonPressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.9,
  },
  micIcon: {
    alignItems: 'center',
  },
  micBody: {
    width: 14,
    height: 22,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
  },
  micBase: {
    width: 20,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
    marginTop: 3,
  },
  textNoteButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...Colors.shadow.md,
  },
  textNoteButtonPressed: {
    transform: [{ scale: 0.92 }],
    backgroundColor: Colors.surfaceHover,
  },
  textNoteIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
});
