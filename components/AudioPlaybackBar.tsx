import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform,
} from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Colors } from '../constants/colors';

interface AudioPlaybackBarProps {
  localUri: string;
  onPlaybackError?: (err: Error) => void;
}

// Web-only audio player using HTMLAudioElement
function WebAudioPlaybackBar({ localUri }: AudioPlaybackBarProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

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

  const seekValue = duration > 0 ? currentTime / duration : 0;

  const formatTime = (seconds: number) => {
    const s = Math.floor(seconds);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

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
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${seekValue * 100}%` }]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
      </View>
    </View>
  );
}

export function AudioPlaybackBar({ localUri, onPlaybackError }: AudioPlaybackBarProps) {
  // On web, use the HTML Audio API directly — blob URLs don't work with expo-file-system
  if (Platform.OS === 'web') {
    return <WebAudioPlaybackBar localUri={localUri} onPlaybackError={onPlaybackError} />;
  }

  return <NativeAudioPlaybackBar localUri={localUri} onPlaybackError={onPlaybackError} />;
}

function NativeAudioPlaybackBar({ localUri, onPlaybackError }: AudioPlaybackBarProps) {
  const [fileAvailable, setFileAvailable] = useState<boolean | null>(null);
  const [seekValue, setSeekValue] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'web') {
      // On web, FileSystem.getInfoAsync is unavailable; blob/object URLs are valid if they exist
      setFileAvailable(!!localUri);
      return;
    }
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

  useEffect(() => {
    setSeekValue(duration > 0 ? currentTime / duration : 0);
  }, [currentTime, duration]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }, [isPlaying, player]);

  const formatTime = (seconds: number) => {
    const s = Math.floor(seconds);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

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
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${seekValue * 100}%` }]} />
        </View>
        {/* Time labels */}
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
      </View>
    </View>
  );
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
