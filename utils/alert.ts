import { Alert, Platform } from 'react-native';

/**
 * Cross-platform confirmation dialog.
 * On web, Alert.alert is a no-op, so we use window.confirm instead.
 */
export const showConfirm = (
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void
): void => {
  if (Platform.OS === 'web') {
    const confirmed = window.confirm(`${title}\n\n${message}`);
    if (confirmed) {
      onConfirm();
    } else {
      onCancel?.();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel', onPress: onCancel },
    { text: title.includes('Delete') || title.includes('Sign') ? title.split(' ')[0] : 'OK', style: 'destructive', onPress: onConfirm },
  ]);
};

/**
 * Cross-platform alert (no buttons).
 * On web, Alert.alert is a no-op, so we use window.alert instead.
 */
export const showAlert = (title: string, message?: string): void => {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
};
