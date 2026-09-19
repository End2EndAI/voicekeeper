import { Note, NoteSort, Tag } from '../types';

/**
 * Reconciles the cached notes with what the server just returned.
 *
 * Conflict policy is last-writer-wins with a local bias: the push runs before
 * the pull, so anything still in the outbox is a change the server has not seen
 * yet and the local row must survive the merge. Everything else is replaced by
 * the server's version, and a cached note the server no longer has was deleted
 * elsewhere, so it is dropped.
 */
export function mergeNotes(
  local: Note[],
  remote: Note[],
  options: { keepLocalIds?: Set<string>; dropIds?: Set<string> } = {}
): Note[] {
  const keepLocalIds = options.keepLocalIds ?? new Set<string>();
  const dropIds = options.dropIds ?? new Set<string>();

  const merged = new Map<string, Note>();

  for (const note of remote) {
    if (dropIds.has(note.id)) continue;
    merged.set(note.id, note);
  }

  for (const note of local) {
    if (dropIds.has(note.id)) continue;
    if (keepLocalIds.has(note.id)) merged.set(note.id, note);
  }

  return Array.from(merged.values());
}

/**
 * Client-side ordering. Notes are served from the cache now, so the ORDER BY
 * that used to live in the PostgREST query happens here instead.
 */
export function sortNotes(notes: Note[], sort: NoteSort): Note[] {
  const sorted = [...notes];

  switch (sort) {
    case 'date_asc':
      sorted.sort((a, b) => cmp(a.created_at, b.created_at) || cmp(a.id, b.id));
      break;
    case 'title_asc':
      sorted.sort(
        (a, b) => a.title.localeCompare(b.title) || cmp(a.id, b.id)
      );
      break;
    case 'title_desc':
      sorted.sort(
        (a, b) => b.title.localeCompare(a.title) || cmp(a.id, b.id)
      );
      break;
    case 'manual':
    case 'date_desc':
    default:
      sorted.sort((a, b) => cmp(b.created_at, a.created_at) || cmp(a.id, b.id));
  }

  return sorted;
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export const isActive = (note: Note): boolean =>
  !note.deleted_at && !note.archived_at;

export const isArchived = (note: Note): boolean =>
  !note.deleted_at && !!note.archived_at;

export const isTrashed = (note: Note): boolean => !!note.deleted_at;

/** Rebuilds the `note id -> Tag[]` shape the UI consumes from the stored ids. */
export function expandNoteTags(
  tags: Tag[],
  noteTags: Record<string, string[]>
): Record<string, Tag[]> {
  const byId = new Map(tags.map((tag) => [tag.id, tag]));
  const map: Record<string, Tag[]> = {};

  for (const [noteId, tagIds] of Object.entries(noteTags)) {
    const resolved = tagIds
      .map((tagId) => byId.get(tagId))
      .filter((tag): tag is Tag => !!tag);
    if (resolved.length > 0) map[noteId] = resolved;
  }

  return map;
}

/** Collapses the UI shape back to ids for storage. */
export function collapseNoteTags(map: Record<string, Tag[]>): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [noteId, tags] of Object.entries(map)) {
    if (tags.length > 0) result[noteId] = tags.map((tag) => tag.id);
  }
  return result;
}
