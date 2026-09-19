import { mergeNotes, sortNotes, isActive, isArchived, isTrashed } from '../services/syncMerge';
import { expandNoteTags, collapseNoteTags } from '../services/syncMerge';
import { Note, Tag } from '../types';

const note = (id: string, overrides: Partial<Note> = {}): Note => ({
  id,
  user_id: 'user-1',
  title: `Note ${id}`,
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

const ids = (notes: Note[]) => notes.map((n) => n.id).sort();

describe('mergeNotes', () => {
  it('takes the server version for notes with nothing pending', () => {
    const local = [note('a', { title: 'Stale' })];
    const remote = [note('a', { title: 'Fresh' })];

    expect(mergeNotes(local, remote)[0].title).toBe('Fresh');
  });

  it('keeps a local note the server has not seen yet', () => {
    const local = [note('a'), note('offline-1')];
    const remote = [note('a')];

    const merged = mergeNotes(local, remote, { keepLocalIds: new Set(['offline-1']) });
    expect(ids(merged)).toEqual(['a', 'offline-1']);
  });

  it('keeps a local edit that is still waiting in the outbox', () => {
    const local = [note('a', { title: 'My edit' })];
    const remote = [note('a', { title: 'Server version' })];

    const merged = mergeNotes(local, remote, { keepLocalIds: new Set(['a']) });
    expect(merged[0].title).toBe('My edit');
  });

  it('drops a cached note the server no longer has', () => {
    const merged = mergeNotes([note('a'), note('gone')], [note('a')]);
    expect(ids(merged)).toEqual(['a']);
  });

  it('hides a note deleted locally even if the server still returns it', () => {
    const merged = mergeNotes([note('a')], [note('a')], { dropIds: new Set(['a']) });
    expect(merged).toEqual([]);
  });

  it('adds notes created on another device', () => {
    const merged = mergeNotes([note('a')], [note('a'), note('b')]);
    expect(ids(merged)).toEqual(['a', 'b']);
  });
});

describe('sortNotes', () => {
  const a = note('a', { title: 'Banana', created_at: '2026-01-02T00:00:00.000Z' });
  const b = note('b', { title: 'Apple', created_at: '2026-01-03T00:00:00.000Z' });
  const c = note('c', { title: 'Cherry', created_at: '2026-01-01T00:00:00.000Z' });

  it('orders newest first by default', () => {
    expect(sortNotes([a, b, c], 'date_desc').map((n) => n.id)).toEqual(['b', 'a', 'c']);
  });

  it('orders oldest first', () => {
    expect(sortNotes([a, b, c], 'date_asc').map((n) => n.id)).toEqual(['c', 'a', 'b']);
  });

  it('orders by title', () => {
    expect(sortNotes([a, b, c], 'title_asc').map((n) => n.id)).toEqual(['b', 'a', 'c']);
    expect(sortNotes([a, b, c], 'title_desc').map((n) => n.id)).toEqual(['c', 'a', 'b']);
  });

  it('does not mutate the input', () => {
    const input = [a, b, c];
    sortNotes(input, 'title_asc');
    expect(input.map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('note state predicates', () => {
  const active = note('a');
  const archived = note('b', { archived_at: '2026-02-01T00:00:00.000Z' });
  const trashed = note('c', { deleted_at: '2026-02-01T00:00:00.000Z' });
  const archivedThenTrashed = note('d', {
    archived_at: '2026-02-01T00:00:00.000Z',
    deleted_at: '2026-02-02T00:00:00.000Z',
  });

  it('puts every note in exactly one bucket', () => {
    const all = [active, archived, trashed, archivedThenTrashed];
    for (const n of all) {
      const buckets = [isActive(n), isArchived(n), isTrashed(n)].filter(Boolean);
      expect(buckets).toHaveLength(1);
    }
  });

  it('treats the trash as taking precedence over the archive', () => {
    expect(isTrashed(archivedThenTrashed)).toBe(true);
    expect(isArchived(archivedThenTrashed)).toBe(false);
  });
});

describe('note/tag link storage', () => {
  const tag = (id: string, name: string): Tag => ({
    id,
    user_id: 'user-1',
    name,
    color: '#6366f1',
    created_at: '2026-01-01T00:00:00.000Z',
  });

  const tags = [tag('t1', 'Work'), tag('t2', 'Ideas')];

  it('round-trips through the compact stored form', () => {
    const map = { 'note-1': [tags[0], tags[1]], 'note-2': [tags[1]] };
    expect(expandNoteTags(tags, collapseNoteTags(map))).toEqual(map);
  });

  it('skips links pointing at a tag that no longer exists', () => {
    const expanded = expandNoteTags(tags, { 'note-1': ['t1', 'deleted-tag'] });
    expect(expanded).toEqual({ 'note-1': [tags[0]] });
  });

  it('omits notes left with no tags', () => {
    expect(expandNoteTags(tags, { 'note-1': ['deleted-tag'] })).toEqual({});
    expect(collapseNoteTags({ 'note-1': [] })).toEqual({});
  });
});
