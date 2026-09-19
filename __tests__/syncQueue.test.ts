import {
  coalesce,
  makeOp,
  locallyOwnedNoteIds,
  locallyPurgedNoteIds,
} from '../services/syncQueue';
import { Note, SyncOp } from '../types';

const note = (id: string, overrides: Partial<Note> = {}): Note => ({
  id,
  user_id: 'user-1',
  title: 'Title',
  formatted_text: 'Body',
  raw_transcription: null,
  format_type: 'paragraph',
  source: 'text',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  archived_at: null,
  deleted_at: null,
  ...overrides,
});

const kinds = (queue: SyncOp[]) => queue.map((op) => op.kind);

describe('coalesce — note operations', () => {
  it('appends a create', () => {
    const queue = coalesce([], makeOp('note.create', { noteId: 'a', note: note('a') }));
    expect(kinds(queue)).toEqual(['note.create']);
  });

  it('folds an update into a create that has not been pushed yet', () => {
    let queue = coalesce([], makeOp('note.create', { noteId: 'a', note: note('a') }));
    queue = coalesce(queue, makeOp('note.update', { noteId: 'a', patch: { title: 'Renamed' } }));

    expect(kinds(queue)).toEqual(['note.create']);
    expect(queue[0].note?.title).toBe('Renamed');
  });

  it('merges consecutive updates on the same note into one patch', () => {
    let queue = coalesce([], makeOp('note.update', { noteId: 'a', patch: { title: 'One' } }));
    queue = coalesce(queue, makeOp('note.update', { noteId: 'a', patch: { formatted_text: 'Two' } }));

    expect(queue).toHaveLength(1);
    expect(queue[0].patch).toEqual({ title: 'One', formatted_text: 'Two' });
  });

  it('lets a later update win over an earlier one for the same column', () => {
    let queue = coalesce([], makeOp('note.update', { noteId: 'a', patch: { title: 'One' } }));
    queue = coalesce(queue, makeOp('note.update', { noteId: 'a', patch: { title: 'Two' } }));

    expect(queue[0].patch).toEqual({ title: 'Two' });
  });

  it('keeps updates for different notes separate', () => {
    let queue = coalesce([], makeOp('note.update', { noteId: 'a', patch: { title: 'A' } }));
    queue = coalesce(queue, makeOp('note.update', { noteId: 'b', patch: { title: 'B' } }));

    expect(queue).toHaveLength(2);
  });

  it('resets the failure count when a patch is merged in', () => {
    const failed: SyncOp = {
      ...makeOp('note.update', { noteId: 'a', patch: { title: 'One' } }),
      attempts: 3,
      lastError: 'boom',
    };
    const queue = coalesce([failed], makeOp('note.update', { noteId: 'a', patch: { title: 'Two' } }));

    expect(queue[0].attempts).toBe(0);
    expect(queue[0].lastError).toBeUndefined();
  });

  it('drops every pending operation for a purged note', () => {
    let queue = coalesce([], makeOp('note.create', { noteId: 'a', note: note('a') }));
    queue = coalesce(queue, makeOp('note.update', { noteId: 'b', patch: { title: 'Keep me' } }));
    queue = coalesce(queue, makeOp('noteTag.add', { noteId: 'a', tagId: 't1' }));
    queue = coalesce(queue, makeOp('note.purge', { noteId: 'a' }));

    expect(kinds(queue)).toEqual(['note.update', 'note.purge']);
    expect(queue[0].noteId).toBe('b');
  });
});

describe('coalesce — note/tag links', () => {
  it('cancels a pending remove when the tag is added back', () => {
    let queue = coalesce([], makeOp('noteTag.remove', { noteId: 'a', tagId: 't1' }));
    queue = coalesce(queue, makeOp('noteTag.add', { noteId: 'a', tagId: 't1' }));

    expect(kinds(queue)).toEqual(['noteTag.add']);
  });

  it('cancels a pending add when the tag is removed again', () => {
    let queue = coalesce([], makeOp('noteTag.add', { noteId: 'a', tagId: 't1' }));
    queue = coalesce(queue, makeOp('noteTag.remove', { noteId: 'a', tagId: 't1' }));

    expect(kinds(queue)).toEqual(['noteTag.remove']);
  });

  it('does not queue the same link twice', () => {
    let queue = coalesce([], makeOp('noteTag.add', { noteId: 'a', tagId: 't1' }));
    queue = coalesce(queue, makeOp('noteTag.add', { noteId: 'a', tagId: 't1' }));

    expect(queue).toHaveLength(1);
  });

  it('keeps a link behind the creation of the note it points at', () => {
    let queue = coalesce([], makeOp('note.create', { noteId: 'a', note: note('a') }));
    queue = coalesce(queue, makeOp('noteTag.add', { noteId: 'a', tagId: 't1' }));

    expect(kinds(queue)).toEqual(['note.create', 'noteTag.add']);
  });
});

describe('pending id helpers', () => {
  it('reports notes whose local version has not been pushed', () => {
    let queue = coalesce([], makeOp('note.create', { noteId: 'a', note: note('a') }));
    queue = coalesce(queue, makeOp('note.update', { noteId: 'b', patch: { title: 'B' } }));
    queue = coalesce(queue, makeOp('noteTag.add', { noteId: 'c', tagId: 't1' }));

    expect(locallyOwnedNoteIds(queue)).toEqual(new Set(['a', 'b']));
  });

  it('reports notes deleted locally but not yet on the server', () => {
    const queue = coalesce([], makeOp('note.purge', { noteId: 'a' }));
    expect(locallyPurgedNoteIds(queue)).toEqual(new Set(['a']));
  });
});
