import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Animated, View } from 'react-native';
import { Colors } from '../constants/colors';

interface RecordButtonProps {
  onPress: () => void;
}

export const RecordButton: React.FC<RecordButtonProps> = ({ onPress }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.pulseRing,
          { transform: [{ scale: pulseAnim }] },
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
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'box-none',
  } as any,
  pulseRing: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.recordingPulse,
    opacity: 0.3,
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.recording,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.recording,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
});
