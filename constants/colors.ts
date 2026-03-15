export const Colors = {
  // Primary — warm indigo, elegant and modern
  primary: '#6366F1',
  primaryLight: '#A5B4FC',
  primaryDark: '#4338CA',
  primarySubtle: '#EEF2FF',

  // Backgrounds — warm off-whites
  background: '#FAFAF9',
  surface: '#FFFFFF',
  surfaceHover: '#F5F5F4',
  surfaceElevated: '#FFFFFF',

  // Text — warm grays for softer contrast
  text: '#1C1917',
  textSecondary: '#57534E',
  textTertiary: '#A8A29E',

  // Borders — very subtle
  border: '#E7E5E4',
  borderLight: '#F5F5F4',

  // Semantic
  error: '#DC2626',
  errorLight: '#FEF2F2',
  success: '#059669',
  successLight: '#ECFDF5',
  warning: '#D97706',
  warningLight: '#FFFBEB',

  // Recording — vibrant coral red
  recording: '#F43F5E',
  recordingLight: '#FFE4E6',
  recordingPulse: '#FDA4AF',

  // Overlay
  overlay: 'rgba(28, 25, 23, 0.4)',

  // Format badge colors — refined, harmonious pastels
  format: {
    bullet_list: { bg: '#EEF2FF', text: '#4F46E5', icon: '•' },
    paragraph: { bg: '#ECFDF5', text: '#059669', icon: '¶' },
    action_items: { bg: '#FFF7ED', text: '#C2410C', icon: '✓' },
    meeting_notes: { bg: '#FAF5FF', text: '#7C3AED', icon: '◎' },
    custom: { bg: '#FEF3C7', text: '#92400E', icon: '✦' },
  } as Record<string, { bg: string; text: string; icon: string }>,

  // Shadows (use as presets)
  shadow: {
    sm: {
      shadowColor: '#1C1917',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#1C1917',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    lg: {
      shadowColor: '#1C1917',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 6,
    },
  },
};
