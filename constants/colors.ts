export const Colors = {
  primary: '#4F46E5',
  primaryLight: '#818CF8',
  primaryDark: '#3730A3',
  background: '#F9FAFB',
  surface: '#FFFFFF',
  surfaceHover: '#F3F4F6',
  text: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  border: '#E5E7EB',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  success: '#10B981',
  warning: '#F59E0B',
  recording: '#EF4444',
  recordingPulse: '#FCA5A5',
  overlay: 'rgba(0, 0, 0, 0.5)',

  // Format badge colors
  format: {
    bullet_list: { bg: '#EEF2FF', text: '#4F46E5' },
    paragraph: { bg: '#F0FDF4', text: '#16A34A' },
    action_items: { bg: '#FFF7ED', text: '#EA580C' },
    meeting_notes: { bg: '#FDF4FF', text: '#9333EA' },
  } as Record<string, { bg: string; text: string }>,
};
