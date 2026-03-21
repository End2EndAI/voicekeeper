import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Modal,
  StyleSheet,
} from 'react-native';
import { Tag } from '../types';
import { TagChip } from './TagChip';
import { Colors } from '../constants/colors';

const TAG_PALETTE = [
  '#6366F1', // indigo
  '#EC4899', // pink
  '#F59E0B', // amber
  '#10B981', // emerald
  '#3B82F6', // blue
  '#EF4444', // red
  '#8B5CF6', // violet
  '#14B8A6', // teal
];

interface TagPickerProps {
  visible: boolean;
  onClose: () => void;
  allTags: Tag[];
  selectedTagIds: string[];
  onToggle: (tagId: string) => void;
  onCreateTag: (name: string, color: string) => void;
}

export const TagPicker: React.FC<TagPickerProps> = ({
  visible,
  onClose,
  allTags,
  selectedTagIds,
  onToggle,
  onCreateTag,
}) => {
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(TAG_PALETTE[0]);
  const [creating, setCreating] = useState(false);

  const handleCreate = () => {
    const trimmed = newTagName.trim();
    if (!trimmed) return;
    onCreateTag(trimmed, selectedColor);
    setNewTagName('');
    setSelectedColor(TAG_PALETTE[0]);
    setCreating(false);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>Tags</Text>

          <ScrollView style={styles.tagList} showsVerticalScrollIndicator={false}>
            {allTags.length === 0 && !creating && (
              <Text style={styles.emptyText}>No tags yet. Create your first one below.</Text>
            )}
            {allTags.map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id);
              return (
                <Pressable
                  key={tag.id}
                  style={({ pressed }) => [
                    styles.tagRow,
                    isSelected && styles.tagRowSelected,
                    pressed && { opacity: 0.75 },
                  ]}
                  onPress={() => onToggle(tag.id)}
                >
                  <TagChip tag={tag} />
                  {isSelected && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          {creating ? (
            <View style={styles.createForm}>
              <TextInput
                style={styles.nameInput}
                value={newTagName}
                onChangeText={setNewTagName}
                placeholder="Tag name"
                placeholderTextColor={Colors.textTertiary}
                autoFocus
                maxLength={30}
              />
              <View style={styles.palette}>
                {TAG_PALETTE.map((color) => (
                  <Pressable
                    key={color}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: color },
                      selectedColor === color && styles.colorSwatchSelected,
                    ]}
                    onPress={() => setSelectedColor(color)}
                  />
                ))}
              </View>
              <View style={styles.createActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.cancelButton,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => {
                    setCreating(false);
                    setNewTagName('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.confirmButton,
                    !newTagName.trim() && styles.confirmButtonDisabled,
                    pressed && newTagName.trim() && { opacity: 0.85 },
                  ]}
                  onPress={handleCreate}
                  disabled={!newTagName.trim()}
                >
                  <Text style={styles.confirmButtonText}>Create</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.addTagButton,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => setCreating(true)}
            >
              <Text style={styles.addTagButtonText}>+ New Tag</Text>
            </Pressable>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.doneButton,
              pressed && { opacity: 0.85 },
            ]}
            onPress={onClose}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    paddingVertical: 12,
  },
  tagList: {
    maxHeight: 280,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 20,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  tagRowSelected: {
    backgroundColor: Colors.primarySubtle,
  },
  checkmark: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '700',
  },
  createForm: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 16,
    marginBottom: 12,
  },
  nameInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.background,
    marginBottom: 12,
  },
  palette: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: Colors.text,
  },
  createActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.4,
  },
  confirmButtonText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  addTagButton: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    marginBottom: 12,
  },
  addTagButtonText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '600',
  },
  doneButton: {
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
