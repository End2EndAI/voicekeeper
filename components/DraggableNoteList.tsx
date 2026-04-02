import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  PanResponder,
  Animated,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Note } from '../types';
import { NoteCard } from './NoteCard';
import { Colors } from '../constants/colors';

interface DraggableNoteListProps {
  notes: Note[];
  onNotePress: (note: Note) => void;
  onReorder: (newIds: string[]) => void;
  onRefresh: () => void;
  loading: boolean;
}

export const DraggableNoteList: React.FC<DraggableNoteListProps> = ({
  notes,
  onNotePress,
  onReorder,
  onRefresh,
  loading,
}) => {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);

  // Per-item heights accumulated from onLayout
  const itemHeights = useRef<number[]>([]);

  // Active drag state
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const dragTranslateY = useRef(new Animated.Value(0)).current;
  const activeDeltaY = useRef(0);

  const getItemTop = (index: number) =>
    itemHeights.current.slice(0, index).reduce((s, h) => s + h, 0);

  // Determine where to insert the dragged item based on its current midpoint Y
  const getInsertIndex = (startIndex: number, deltaY: number): number => {
    const movedTop = getItemTop(startIndex) + deltaY;
    const movedMid = movedTop + (itemHeights.current[startIndex] ?? 80) / 2;

    let cumY = 0;
    for (let i = 0; i < notes.length; i++) {
      if (i === startIndex) {
        cumY += itemHeights.current[i] ?? 80;
        continue;
      }
      const h = itemHeights.current[i] ?? 80;
      if (movedMid < cumY + h / 2) return i;
      cumY += h;
    }
    return notes.length - 1;
  };

  const createPanResponder = useCallback(
    (noteIndex: number) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: () => {
          dragTranslateY.setValue(0);
          activeDeltaY.current = 0;
          setDraggingIndex(noteIndex);
          setScrollEnabled(false);
        },
        onPanResponderMove: (_, gesture) => {
          activeDeltaY.current = gesture.dy;
          dragTranslateY.setValue(gesture.dy);
        },
        onPanResponderRelease: () => {
          const delta = activeDeltaY.current;
          const insertIdx = getInsertIndex(noteIndex, delta);

          if (insertIdx !== noteIndex) {
            const reordered = [...notes];
            const [moved] = reordered.splice(noteIndex, 1);
            reordered.splice(insertIdx, 0, moved);
            onReorder(reordered.map((n) => n.id));
          }

          dragTranslateY.setValue(0);
          setDraggingIndex(null);
          setScrollEnabled(true);
        },
        onPanResponderTerminate: () => {
          dragTranslateY.setValue(0);
          setDraggingIndex(null);
          setScrollEnabled(true);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notes, onReorder]
  );

  return (
    <ScrollView
      ref={scrollRef}
      scrollEnabled={scrollEnabled}
      showsVerticalScrollIndicator={false}
      onScroll={(e) => { scrollOffset.current = e.nativeEvent.contentOffset.y; }}
      scrollEventThrottle={16}
      contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={onRefresh}
          tintColor={Colors.primary}
        />
      }
    >
      {notes.map((note, index) => {
        const isDragging = draggingIndex === index;
        const panResponder = createPanResponder(index);

        return (
          <View
            key={note.id}
            onLayout={(e) => {
              itemHeights.current[index] = e.nativeEvent.layout.height;
            }}
            style={styles.itemWrapper}
          >
            <Animated.View
              style={[
                styles.animatedItem,
                isDragging && {
                  transform: [{ translateY: dragTranslateY }],
                  zIndex: 10,
                  ...Colors.shadow.lg,
                  borderRadius: 16,
                },
              ]}
            >
              <View style={styles.row}>
                <View style={styles.cardWrapper}>
                  <NoteCard note={note} onPress={onNotePress} />
                </View>
                <View
                  style={[styles.dragHandle, isDragging && styles.dragHandleActive]}
                  {...panResponder.panHandlers}
                >
                  <View style={styles.dragBar} />
                  <View style={styles.dragBar} />
                  <View style={styles.dragBar} />
                </View>
              </View>
            </Animated.View>
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 20,
  },
  itemWrapper: {
    marginBottom: 12,
  },
  animatedItem: {
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardWrapper: {
    flex: 1,
  },
  dragHandle: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 20,
    paddingHorizontal: 4,
  },
  dragHandleActive: {
    opacity: 0.5,
  },
  dragBar: {
    width: 18,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: Colors.textTertiary,
  },
});
