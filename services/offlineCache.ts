import { readDocument, writeDocument, removeDocument } from './localStore';
import { Note, NotesSnapshot, Tag, TagsSnapshot } from '../types';

export { expandNoteTags, collapseNoteTags } from './syncMerge';

/**
 * On-disk snapshots of the user's notes and tags.
 *
 * These are what the app renders on launch, before any request goes out: the
 * list is on screen immediately and the network refresh happens behind it.
 * Snapshots are per user, so switching accounts never shows the wrong data.
 */

export const NOTES_SNAPSHOT_VERSION = 1;
export const TAGS_SNAPSHOT_VERSION = 1;

const notesDoc = (userId: string) => `notes-${userId}`;
const tagsDoc = (userId: string) => `tags-${userId}`;

export const emptyNotesSnapshot = (): NotesSnapshot => ({
  version: NOTES_SNAPSHOT_VERSION,
  notes: [],
  lastSyncAt: null,
});

export const emptyTagsSnapshot = (): TagsSnapshot => ({
  version: TAGS_SNAPSHOT_VERSION,
  tags: [],
  noteTags: {},
  lastSyncAt: null,
});

export async function loadNotesSnapshot(userId: string): Promise<NotesSnapshot> {
  const stored = await readDocument<NotesSnapshot>(notesDoc(userId));
  if (!stored || stored.version !== NOTES_SNAPSHOT_VERSION || !Array.isArray(stored.notes)) {
    return emptyNotesSnapshot();
  }
  return stored;
}

export async function saveNotesSnapshot(
  userId: string,
  notes: Note[],
  lastSyncAt: string | null
): Promise<void> {
  await writeDocument(notesDoc(userId), {
    version: NOTES_SNAPSHOT_VERSION,
    notes,
    lastSyncAt,
  } satisfies NotesSnapshot);
}

export async function loadTagsSnapshot(userId: string): Promise<TagsSnapshot> {
  const stored = await readDocument<TagsSnapshot>(tagsDoc(userId));
  if (!stored || stored.version !== TAGS_SNAPSHOT_VERSION || !Array.isArray(stored.tags)) {
    return emptyTagsSnapshot();
  }
  return { ...stored, noteTags: stored.noteTags ?? {} };
}

export async function saveTagsSnapshot(
  userId: string,
  tags: Tag[],
  noteTags: Record<string, string[]>,
  lastSyncAt: string | null
): Promise<void> {
  await writeDocument(tagsDoc(userId), {
    version: TAGS_SNAPSHOT_VERSION,
    tags,
    noteTags,
    lastSyncAt,
  } satisfies TagsSnapshot);
}

/** Wipes a user's cached content (account deletion). */
export async function clearOfflineCache(userId: string): Promise<void> {
  await Promise.all([removeDocument(notesDoc(userId)), removeDocument(tagsDoc(userId))]);
}
