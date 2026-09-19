import { Note, SyncOp, SyncOpKind } from '../types';
import { uuidv4 } from '../utils/uuid';

/**
 * Pure outbox logic: how a new mutation folds into the operations that are
 * still waiting to be pushed. Keeping this side-effect free makes the
 * interesting cases (edit a note that was created offline, delete it again
 * before it ever reached the server) easy to test.
 *
 * The queue is a single FIFO across notes and note/tag links so that ordering
 * dependencies hold — a note must exist remotely before a link to it inserts.
 */

export const MAX_ATTEMPTS = 5;

export function makeOp(
  kind: SyncOpKind,
  fields: Omit<SyncOp, 'id' | 'kind' | 'queuedAt' | 'attempts'>
): SyncOp {
  return {
    id: uuidv4(),
    kind,
    queuedAt: new Date().toISOString(),
    attempts: 0,
    ...fields,
  };
}

/**
 * Folds `op` into `queue`, returning a new queue.
 *
 * - an update on a note whose create is still queued rewrites the create
 * - consecutive updates on the same note collapse into one patch
 * - a purge cancels every pending operation for that note, then queues itself
 *   (a DELETE against a row that never reached the server is a harmless no-op,
 *   and keeping it covers the case where the create did land but its response
 *   was lost)
 * - add/remove of the same note/tag link cancel each other out
 */
export function coalesce(queue: SyncOp[], op: SyncOp): SyncOp[] {
  switch (op.kind) {
    case 'note.create':
      return [...queue, op];

    case 'note.update': {
      const createIndex = queue.findIndex(
        (q) => q.kind === 'note.create' && q.noteId === op.noteId
      );
      if (createIndex !== -1) {
        const next = [...queue];
        const create = next[createIndex];
        next[createIndex] = {
          ...create,
          note: { ...(create.note as Note), ...(op.patch ?? {}) },
        };
        return next;
      }

      const updateIndex = queue.findIndex(
        (q) => q.kind === 'note.update' && q.noteId === op.noteId
      );
      if (updateIndex !== -1) {
        const next = [...queue];
        next[updateIndex] = {
          ...next[updateIndex],
          patch: { ...(next[updateIndex].patch ?? {}), ...(op.patch ?? {}) },
          // A merged patch is a fresh attempt: don't inherit a failure count
          attempts: 0,
          lastError: undefined,
        };
        return next;
      }

      return [...queue, op];
    }

    case 'note.purge':
      return [...queue.filter((q) => q.noteId !== op.noteId), op];

    case 'noteTag.add':
    case 'noteTag.remove': {
      const opposite: SyncOpKind =
        op.kind === 'noteTag.add' ? 'noteTag.remove' : 'noteTag.add';

      const pendingSame = queue.some(
        (q) => q.kind === op.kind && q.noteId === op.noteId && q.tagId === op.tagId
      );

      const withoutOpposite = queue.filter(
        (q) => !(q.kind === opposite && q.noteId === op.noteId && q.tagId === op.tagId)
      );

      // Already queued and nothing cancelled it out — nothing to add
      if (pendingSame && withoutOpposite.length === queue.length) return queue;

      return [...withoutOpposite, op];
    }

    default:
      return [...queue, op];
  }
}

/** Note ids whose local version must win over whatever the server returns. */
export function locallyOwnedNoteIds(queue: SyncOp[]): Set<string> {
  const ids = new Set<string>();
  for (const op of queue) {
    if (op.kind === 'note.create' || op.kind === 'note.update') ids.add(op.noteId);
  }
  return ids;
}

/** Note ids deleted locally that must stay hidden until the delete is pushed. */
export function locallyPurgedNoteIds(queue: SyncOp[]): Set<string> {
  const ids = new Set<string>();
  for (const op of queue) {
    if (op.kind === 'note.purge') ids.add(op.noteId);
  }
  return ids;
}
