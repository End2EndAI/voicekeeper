import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors } from '../constants/colors';

interface AudioWaveformProps {
  metering: number; // 0-1 normalized value
  isRecording: boolean;
}

const BAR_COUNT = 20;

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  metering,
  isRecording,
}) => {
  const barAnims = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.15))
  ).current;

  useEffect(() => {
    if (!isRecording) {
      barAnims.forEach((anim) => {
        Animated.timing(anim, {
          toValue: 0.15,
          duration: 300,
          useNativeDriver: false,
        }).start();
      });
      return;
    }

    barAnims.forEach((anim, index) => {
      // Create a wave-like effect with slight delay per bar
      const distFromCenter = Math.abs(index - BAR_COUNT / 2) / (BAR_COUNT / 2);
      const targetHeight = Math.max(
        0.15,
        metering * (1 - distFromCenter * 0.5) + Math.random() * 0.15
      );

      Animated.timing(anim, {
        toValue: targetHeight,
        duration: 100,
        useNativeDriver: false,
      }).start();
    });
  }, [metering, isRecording, barAnims]);

  return (
    <View style={styles.container}>
      {barAnims.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            {
              height: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [4, 60],
              }),
              backgroundColor: isRecording
                ? Colors.recording
                : Colors.textTertiary,
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 64,
    gap: 3,
  },
  bar: {
    width: 4,
    borderRadius: 2,
    minHeight: 4,
  },
});
