import { FormatType } from '../types';

export interface FormatOption {
  value: FormatType;
  label: string;
  description: string;
  icon: string;
}

export const FORMAT_OPTIONS: FormatOption[] = [
  {
    value: 'bullet_list',
    label: 'Bullet List',
    description: 'Key points as a concise bulleted list',
    icon: '•',
  },
  {
    value: 'paragraph',
    label: 'Paragraph',
    description: 'Clean, well-structured prose',
    icon: '¶',
  },
  {
    value: 'action_items',
    label: 'Action Items',
    description: 'Tasks as checkbox items',
    icon: '☑',
  },
  {
    value: 'meeting_notes',
    label: 'Meeting Notes',
    description: 'Structured with topics, decisions, and actions',
    icon: '📋',
  },
  {
    value: 'custom',
    label: 'Custom',
    description: 'Your own format, defined by an example',
    icon: '✏️',
  },
];

export const FORMAT_LABELS: Record<FormatType, string> = {
  bullet_list: 'Bullet List',
  paragraph: 'Paragraph',
  action_items: 'Action Items',
  meeting_notes: 'Meeting Notes',
  custom: 'Custom',
};

export const DEFAULT_FORMAT: FormatType = 'bullet_list';

export const MAX_RECORDING_DURATION_MS = 5 * 60 * 1000; // 5 minutes
export const NOTES_PAGE_SIZE = 20;
