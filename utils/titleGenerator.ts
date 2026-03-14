/**
 * Generates a fallback title from text content.
 * Takes the first N words and truncates if needed.
 */
export const generateFallbackTitle = (text: string, maxWords: number = 5): string => {
  if (!text || text.trim().length === 0) {
    return 'Untitled Note';
  }

  const words = text.trim().split(/\s+/);
  const titleWords = words.slice(0, maxWords);
  let title = titleWords.join(' ');

  if (words.length > maxWords) {
    title += '...';
  }

  return title;
};

/**
 * Formats a date string for display.
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
};

/**
 * Truncates text to a maximum number of characters.
 */
export const truncateText = (text: string, maxLength: number = 150): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trimEnd() + '...';
};
