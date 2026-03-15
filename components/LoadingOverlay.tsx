import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import { Colors } from '../constants/colors';

interface LoadingOverlayProps {
  visible: boolean;
  message: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  message,
}) => {
  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.spinnerContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 36,
    alignItems: 'center',
    minWidth: 220,
    ...Colors.shadow.lg,
  },
  spinnerContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primarySubtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 22,
  },
});
