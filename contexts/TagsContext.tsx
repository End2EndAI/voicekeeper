import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
  ReactNode,
} from 'react';
import { Tag } from '../types';
import * as tagsService from '../services/tags';
import {
  loadTagsSnapshot,
  saveTagsSnapshot,
  emptyTagsSnapshot,
  expandNoteTags,
  collapseNoteTags,
} from '../services/offlineCache';
import { enqueue, registerPuller } from '../services/sync';
import { makeOp } from '../services/syncQueue';
import { useAuth } from './AuthContext';

/**
 * Tags, cached on the device alongside the notes.
 *
 * The tag list and the note/tag links are read from the local snapshot so the
 * home screen's chips and filters work with no connection. Attaching or
 * detaching a tag goes through the sync outbox, which keeps it ordered behind
 * the note's own creation. Creating, renaming and deleting a tag still needs
 * the server (it is a rare, deliberate action) and surfaces an error offline.
 */

interface TagsContextType {
  tags: Tag[];
  noteTagsMap: Record<string, Tag[]>;
  loading: boolean;
  fetchTags: () => Promise<void>;
  refreshNoteTagsMap: () => Promise<void>;
  createTag: (name: string, color: string) => Promise<Tag>;
  updateTag: (id: string, name: string, color: string) => Promise<Tag>;
  deleteTag: (id: string) => Promise<void>;
  addTagToNote: (noteId: string, tagId: string) => Promise<void>;
  removeTagFromNote: (noteId: string, tagId: string) => Promise<void>;
  fetchTagsForNote: (noteId: string) => Promise<Tag[]>;
  /** Ids of the notes carrying a tag, answered from the cache. */
  noteIdsForTag: (tagId: string) => string[];
}

const TagsContext = createContext<TagsContextType | undefined>(undefined);

export const TagsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [tags, setTags] = useState<Tag[]>([]);
  const [noteTags, setNoteTags] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  const tagsRef = useRef<Tag[]>([]);
  const noteTagsRef = useRef<Record<string, string[]>>({});
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = userId;
  // See NotesContext: guards against a slow cache read clobbering a fast pull.
  const hydratedRef = useRef(false);

  const commit = useCallback(
    async (nextTags: Tag[], nextNoteTags: Record<string, string[]>): Promise<void> => {
      hydratedRef.current = true;
      tagsRef.current = nextTags;
      noteTagsRef.current = nextNoteTags;
      setTags(nextTags);
      setNoteTags(nextNoteTags);
      const uid = userIdRef.current;
      if (uid) await saveTagsSnapshot(uid, nextTags, nextNoteTags, new Date().toISOString());
    },
    []
  );

  /** Pull phase: refresh both the tag list and the links in one go. */
  const pull = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    const [remoteTags, remoteMap] = await Promise.all([
      tagsService.fetchTags(),
      tagsService.fetchNoteTagsMap(),
    ]);
    // The account may have changed while the requests were in flight
    if (userIdRef.current !== uid) return;
    await commit(remoteTags, collapseNoteTags(remoteMap));
  }, [commit]);

  useEffect(() => registerPuller('tags', pull), [pull]);

  // Cached snapshot first; the sync engine refreshes it behind the UI.
  useEffect(() => {
    let cancelled = false;

    hydratedRef.current = false;

    if (!userId) {
      tagsRef.current = [];
      noteTagsRef.current = {};
      setTags([]);
      setNoteTags({});
      setLoading(false);
      return;
    }

    setLoading(true);

    (async () => {
      const snapshot = await loadTagsSnapshot(userId).catch(emptyTagsSnapshot);
      if (cancelled) return;
      if (!hydratedRef.current) {
        hydratedRef.current = true;
        tagsRef.current = snapshot.tags;
        noteTagsRef.current = snapshot.noteTags;
        setTags(snapshot.tags);
        setNoteTags(snapshot.noteTags);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // --- Tag CRUD (requires the server) --------------------------------------

  const createTag = useCallback(
    async (name: string, color: string): Promise<Tag> => {
      const tag = await tagsService.createTag(name, color);
      const next = [...tagsRef.current, tag].sort((a, b) => a.name.localeCompare(b.name));
      await commit(next, noteTagsRef.current);
      return tag;
    },
    [commit]
  );

  const updateTag = useCallback(
    async (id: string, name: string, color: string): Promise<Tag> => {
      const updated = await tagsService.updateTag(id, name, color);
      const next = tagsRef.current
        .map((t) => (t.id === id ? updated : t))
        .sort((a, b) => a.name.localeCompare(b.name));
      await commit(next, noteTagsRef.current);
      return updated;
    },
    [commit]
  );

  const deleteTag = useCallback(
    async (id: string): Promise<void> => {
      await tagsService.deleteTag(id);
      const nextTags = tagsRef.current.filter((t) => t.id !== id);
      const nextLinks: Record<string, string[]> = {};
      for (const [noteId, tagIds] of Object.entries(noteTagsRef.current)) {
        const kept = tagIds.filter((tagId) => tagId !== id);
        if (kept.length > 0) nextLinks[noteId] = kept;
      }
      await commit(nextTags, nextLinks);
    },
    [commit]
  );

  // --- Note/tag links (queued, work offline) -------------------------------

  const addTagToNote = useCallback(
    async (noteId: string, tagId: string): Promise<void> => {
      const existing = noteTagsRef.current[noteId] ?? [];
      if (!existing.includes(tagId)) {
        await commit(tagsRef.current, {
          ...noteTagsRef.current,
          [noteId]: [...existing, tagId],
        });
      }
      await enqueue(makeOp('noteTag.add', { noteId, tagId }));
    },
    [commit]
  );

  const removeTagFromNote = useCallback(
    async (noteId: string, tagId: string): Promise<void> => {
      const kept = (noteTagsRef.current[noteId] ?? []).filter((id) => id !== tagId);
      const next = { ...noteTagsRef.current };
      if (kept.length > 0) next[noteId] = kept;
      else delete next[noteId];
      await commit(tagsRef.current, next);
      await enqueue(makeOp('noteTag.remove', { noteId, tagId }));
    },
    [commit]
  );

  // --- Reads ---------------------------------------------------------------

  const noteTagsMap = useMemo(() => expandNoteTags(tags, noteTags), [tags, noteTags]);

  const fetchTagsForNote = useCallback(
    async (noteId: string): Promise<Tag[]> => noteTagsMap[noteId] ?? [],
    [noteTagsMap]
  );

  const noteIdsForTag = useCallback(
    (tagId: string): string[] =>
      Object.entries(noteTags)
        .filter(([, tagIds]) => tagIds.includes(tagId))
        .map(([noteId]) => noteId),
    [noteTags]
  );

  return (
    <TagsContext.Provider
      value={{
        tags,
        noteTagsMap,
        loading,
        fetchTags: pull,
        refreshNoteTagsMap: pull,
        createTag,
        updateTag,
        deleteTag,
        addTagToNote,
        removeTagFromNote,
        fetchTagsForNote,
        noteIdsForTag,
      }}
    >
      {children}
    </TagsContext.Provider>
  );
};

export const useTags = (): TagsContextType => {
  const context = useContext(TagsContext);
  if (context === undefined) {
    throw new Error('useTags must be used within a TagsProvider');
  }
  return context;
};
