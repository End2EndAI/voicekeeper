import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, PanResponder,
} from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import { Colors } from '../constants/colors';

interface AudioPlaybackBarProps {
  localUri: string;
  fileSizeBytes?: number;
  onPlaybackError?: (err: Error) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const formatTime = (seconds: number) => {
  const s = Math.floor(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const THUMB_SIZE = 12;
const HIT_AREA_HEIGHT = 20;

// Web-only audio player using HTMLAudioElement
function WebAudioPlaybackBar({ localUri, fileSizeBytes }: AudioPlaybackBarProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [scrubPosition, setScrubPosition] = useState<number | null>(null);

  const durationRef = useRef(0);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  useEffect(() => {
    const audio = new Audio(localUri);
    audioRef.current = audio;
    audio.onloadedmetadata = () => setDuration(audio.duration);
    audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
    audio.onended = () => setIsPlaying(false);
    return () => { audio.pause(); audioRef.current = null; };
  }, [localUri]);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const seekTo = useCallback((ratio: number) => {
    const audio = audioRef.current;
    if (!audio || durationRef.current <= 0) return;
    audio.currentTime = ratio * durationRef.current;
  }, []);

  const panResponder = useMemo(() => buildPanResponder(durationRef, seekTo, setScrubPosition), [seekTo]);

  const seekValue = duration > 0 ? currentTime / duration : 0;
  const displayValue = scrubPosition ?? seekValue;

  return (
    <View style={styles.container}>
      <Pressable
        onPress={handlePlayPause}
        style={({ pressed }) => [styles.playButton, pressed && { opacity: 0.7 }]}
        accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
      >
        <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
      </Pressable>
      <View style={styles.trackContainer}>
        <View style={styles.trackHitArea} {...panResponder.panHandlers}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${displayValue * 100}%` as any }]} />
          </View>
          <View style={[styles.thumb, { left: `${displayValue * 100}%` as any }]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
          {fileSizeBytes != null && (
            <Text style={styles.timeText}>{formatFileSize(fileSizeBytes)}</Text>
          )}
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
      </View>
    </View>
  );
}

export function AudioPlaybackBar({ localUri, fileSizeBytes, onPlaybackError }: AudioPlaybackBarProps) {
  // On web, use the HTML Audio API directly — blob URLs don't work with expo-file-system
  if (Platform.OS === 'web') {
    return <WebAudioPlaybackBar localUri={localUri} fileSizeBytes={fileSizeBytes} onPlaybackError={onPlaybackError} />;
  }

  return <NativeAudioPlaybackBar localUri={localUri} fileSizeBytes={fileSizeBytes} onPlaybackError={onPlaybackError} />;
}

function NativeAudioPlaybackBar({ localUri, fileSizeBytes, onPlaybackError }: AudioPlaybackBarProps) {
  const [fileAvailable, setFileAvailable] = useState<boolean | null>(null);
  const [scrubPosition, setScrubPosition] = useState<number | null>(null);

  useEffect(() => {
    FileSystem.getInfoAsync(localUri)
      .then(info => {
        setFileAvailable(info.exists);
        if (!info.exists) {
          onPlaybackError?.(new Error(`File not found: ${localUri}`));
        }
      })
      .catch(() => {
        setFileAvailable(false);
        onPlaybackError?.(new Error(`Failed to check file: ${localUri}`));
      });
  }, [localUri]);

  const player = useAudioPlayer(fileAvailable ? localUri : null);
  const status = useAudioPlayerStatus(player);

  const isPlaying = status.playing;
  const duration = status.duration ?? 0;
  const currentTime = status.currentTime ?? 0;

  const durationRef = useRef(0);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }, [isPlaying, player]);

  const seekTo = useCallback((ratio: number) => {
    if (durationRef.current <= 0) return;
    player.seekTo(ratio * durationRef.current);
  }, [player]);

  const panResponder = useMemo(() => buildPanResponder(durationRef, seekTo, setScrubPosition), [seekTo]);

  const seekValue = duration > 0 ? currentTime / duration : 0;
  const displayValue = scrubPosition ?? seekValue;

  if (fileAvailable === null) {
    return (
      <View style={styles.unavailable}>
        <Text style={styles.unavailableText}>Loading…</Text>
      </View>
    );
  }

  if (!fileAvailable) {
    return (
      <View style={styles.unavailable}>
        <Text style={styles.unavailableText}>
          Recording no longer available on this device
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Play/Pause */}
      <Pressable
        onPress={handlePlayPause}
        style={({ pressed }) => [styles.playButton, pressed && { opacity: 0.7 }]}
        accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
      >
        <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
      </Pressable>

      {/* Seek track */}
      <View style={styles.trackContainer}>
        <View style={styles.trackHitArea} {...panResponder.panHandlers}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${displayValue * 100}%` as any }]} />
          </View>
          <View style={[styles.thumb, { left: `${displayValue * 100}%` as any }]} />
        </View>
        {/* Time labels */}
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
          {fileSizeBytes != null && (
            <Text style={styles.timeText}>{formatFileSize(fileSizeBytes)}</Text>
          )}
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Shared PanResponder factory for the seek bar.
 * Uses refs so the gesture handler doesn't need to be recreated on every status update.
 */
function buildPanResponder(
  durationRef: React.MutableRefObject<number>,
  seekTo: (ratio: number) => void,
  setScrubPosition: (v: number | null) => void,
) {
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  let trackWidth = 0;

  return PanResponder.create({
    onStartShouldSetPanResponder: () => durationRef.current > 0,
    onMoveShouldSetPanResponder: () => durationRef.current > 0,
    onPanResponderGrant: (e) => {
      trackWidth = e.nativeEvent.target
        ? (e.nativeEvent as any).currentTarget?.offsetWidth ?? trackWidth
        : trackWidth;
      const ratio = clamp(e.nativeEvent.locationX / (trackWidth || 1), 0, 1);
      setScrubPosition(ratio);
    },
    onPanResponderMove: (e) => {
      const ratio = clamp(e.nativeEvent.locationX / (trackWidth || 1), 0, 1);
      setScrubPosition(ratio);
    },
    onPanResponderRelease: (e) => {
      const ratio = clamp(e.nativeEvent.locationX / (trackWidth || 1), 0, 1);
      seekTo(ratio);
      setScrubPosition(null);
    },
    onPanResponderTerminate: () => setScrubPosition(null),
  });
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 16,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 18,
    color: '#fff',
  },
  trackContainer: {
    flex: 1,
    gap: 4,
  },
  trackHitArea: {
    height: HIT_AREA_HEIGHT,
    justifyContent: 'center',
  },
  track: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: Colors.primary,
    top: (HIT_AREA_HEIGHT - THUMB_SIZE) / 2,
    transform: [{ translateX: -THUMB_SIZE / 2 }],
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontVariant: ['tabular-nums'],
  },
  unavailable: {
    backgroundColor: Colors.surfaceHover,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  unavailableText: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
