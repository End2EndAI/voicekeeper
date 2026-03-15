import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors } from '../constants/colors';

interface AudioWaveformProps {
  metering: number; // 0-1 normalized value
  isRecording: boolean;
}

const BAR_COUNT = 24;

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  metering,
  isRecording,
}) => {
  const barAnims = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.1))
  ).current;

  useEffect(() => {
    if (!isRecording) {
      barAnims.forEach((anim) => {
        Animated.timing(anim, {
          toValue: 0.1,
          duration: 400,
          useNativeDriver: false,
        }).start();
      });
      return;
    }

    barAnims.forEach((anim, index) => {
      const distFromCenter = Math.abs(index - BAR_COUNT / 2) / (BAR_COUNT / 2);
      const targetHeight = Math.max(
        0.1,
        metering * (1 - distFromCenter * 0.6) + Math.random() * 0.12
      );

      Animated.timing(anim, {
        toValue: targetHeight,
        duration: 80,
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
                outputRange: [3, 56],
              }),
              backgroundColor: isRecording
                ? Colors.recording
                : Colors.border,
              opacity: isRecording ? 0.85 : 0.4,
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
    width: 3,
    borderRadius: 1.5,
    minHeight: 3,
  },
});
