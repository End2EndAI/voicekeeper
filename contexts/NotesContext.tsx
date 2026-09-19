import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Note,
  CreateNoteInput,
  UpdateNoteInput,
  NoteSort,
  SyncState,
} from '../types';
import * as notesService from '../services/notes';
import {
  loadNotesSnapshot,
  saveNotesSnapshot,
  emptyNotesSnapshot,
} from '../services/offlineCache';
import {
  configureSync,
  enqueue,
  pendingNoteIds,
  purgedNoteIds,
  registerPuller,
  runSync,
  startSyncEngine,
  subscribeToSync,
  getSyncState,
} from '../services/sync';
import { makeOp } from '../services/syncQueue';
import { mergeNotes, sortNotes, isActive, isArchived, isTrashed } from '../services/syncMerge';
import { uuidv4 } from '../utils/uuid';
import { useAuth } from './AuthContext';

const SORT_KEY = '@voicekeeper/notes_sort';
const MANUAL_ORDER_KEY = '@voicekeeper/manual_order';

/**
 * Offline-first notes store.
 *
 * Notes live on the device and are mirrored to Supabase, not the other way
 * round: the cached snapshot renders immediately on launch, every mutation is
 * applied locally and recorded in the sync outbox, and the network round-trip
 * happens in the background. The app therefore works with no connection at all,
 * and never blocks the UI on a request.
 */

interface NotesContextType {
  /** Active notes — not archived, not in the trash. */
  notes: Note[];
  /** Every cached note, including archived and trashed ones. */
  allNotes: Note[];
  archivedNotes: Note[];
  trashedNotes: Note[];
  loading: boolean;
  searchQuery: string;
  sort: NoteSort;
  manualOrder: string[];
  filteredNotes: Note[];
  sync: SyncState;
  getNoteById: (id: string) => Note | undefined;
  fetchNotes: () => Promise<void>;
  syncNow: () => Promise<void>;
  createNote: (input: CreateNoteInput) => Promise<Note>;
  updateNote: (id: string, updates: UpdateNoteInput) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  archiveNote: (id: string) => Promise<void>;
  unarchiveNote: (id: string) => Promise<void>;
  trashNote: (id: string) => Promise<void>;
  restoreNote: (id: string) => Promise<void>;
  deleteNotePermanently: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSort: (sort: NoteSort) => void;
  setManualOrder: (ids: string[]) => void;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

export const NotesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQueryState] = useState('');
  const [sort, setSortState] = useState<NoteSort>('manual');
  const [manualOrder, setManualOrderState] = useState<string[]>([]);
  const [sync, setSync] = useState<SyncState>(getSyncState);

  // The puller and the mutation helpers run outside React's render cycle, so
  // they read the current notes through a ref rather than a stale closure.
  const notesRef = useRef<Note[]>([]);
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = userId;
  // Set as soon as anything authoritative lands, so a slow cache read can never
  // overwrite a pull that got there first.
  const hydratedRef = useRef(false);

  const commit = useCallback(
    async (next: Note[]): Promise<void> => {
      hydratedRef.current = true;
      notesRef.current = next;
      setAllNotes(next);
      const uid = userIdRef.current;
      if (uid) await saveNotesSnapshot(uid, next, new Date().toISOString());
    },
    []
  );

  const mutate = useCallback(
    (updater: (current: Note[]) => Note[]): Promise<void> => commit(updater(notesRef.current)),
    [commit]
  );

  // --- Preferences that live purely on the device -------------------------

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(SORT_KEY),
      AsyncStorage.getItem(MANUAL_ORDER_KEY),
    ])
      .then(([savedSort, savedOrder]) => {
        if (savedSort) setSortState(savedSort as NoteSort);
        if (savedOrder) setManualOrderState(JSON.parse(savedOrder) as string[]);
      })
      .catch(() => {});
  }, []);

  // --- Sync engine wiring --------------------------------------------------

  useEffect(() => subscribeToSync(setSync), []);
  useEffect(() => startSyncEngine(), []);

  /** Pull phase: replace the cache with the server's state, keeping unpushed work. */
  const pull = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    const remote = await notesService.fetchAllNotes();
    // The account may have changed while the request was in flight
    if (userIdRef.current !== uid) return;
    await commit(
      mergeNotes(notesRef.current, remote, {
        keepLocalIds: pendingNoteIds(),
        dropIds: purgedNoteIds(),
      })
    );
  }, [commit]);

  useEffect(() => registerPuller('notes', pull), [pull]);

  // Load the cached snapshot, then sync behind it.
  useEffect(() => {
    let cancelled = false;

    hydratedRef.current = false;

    if (!userId) {
      notesRef.current = [];
      setAllNotes([]);
      setSearchQueryState('');
      setLoading(false);
      void configureSync(null);
      return;
    }

    setLoading(true);

    (async () => {
      const snapshot = await loadNotesSnapshot(userId).catch(emptyNotesSnapshot);
      if (cancelled) return;

      if (!hydratedRef.current) {
        hydratedRef.current = true;
        notesRef.current = snapshot.notes;
        setAllNotes(snapshot.notes);
      }
      setLoading(false);

      await configureSync(userId);
      if (cancelled) return;
      void runSync();
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // --- Mutations -----------------------------------------------------------

  const createNote = useCallback(
    async (input: CreateNoteInput): Promise<Note> => {
      const uid = userIdRef.current;
      if (!uid) throw new Error('Not authenticated');

      const now = new Date().toISOString();
      const note: Note = {
        id: uuidv4(),
        user_id: uid,
        title: input.title,
        formatted_text: input.formatted_text,
        raw_transcription: input.raw_transcription ?? null,
        format_type: input.format_type,
        source: input.source ?? 'voice',
        audio_uri: input.audio_uri,
        created_at: now,
        updated_at: now,
        archived_at: null,
        deleted_at: null,
      };

      await mutate((current) => [note, ...current]);
      await enqueue(makeOp('note.create', { noteId: note.id, note }));
      return note;
    },
    [mutate]
  );

  /** Applies a patch locally and queues the same patch for Supabase. */
  const patchNote = useCallback(
    async (id: string, patch: Partial<Note>): Promise<void> => {
      const updatedAt = new Date().toISOString();
      await mutate((current) =>
        current.map((note) =>
          note.id === id ? { ...note, ...patch, updated_at: updatedAt } : note
        )
      );
      await enqueue(makeOp('note.update', { noteId: id, patch }));
    },
    [mutate]
  );

  const updateNote = useCallback(
    (id: string, updates: UpdateNoteInput) => patchNote(id, updates),
    [patchNote]
  );

  const trashNote = useCallback(
    (id: string) => patchNote(id, { deleted_at: new Date().toISOString() }),
    [patchNote]
  );

  const restoreNote = useCallback(
    (id: string) => patchNote(id, { deleted_at: null }),
    [patchNote]
  );

  const archiveNote = useCallback(
    (id: string) => patchNote(id, { archived_at: new Date().toISOString() }),
    [patchNote]
  );

  const unarchiveNote = useCallback(
    (id: string) => patchNote(id, { archived_at: null }),
    [patchNote]
  );

  // Soft delete — the note goes to the trash, same as before
  const deleteNote = useCallback((id: string) => trashNote(id), [trashNote]);

  const deleteNotePermanently = useCallback(
    async (id: string): Promise<void> => {
      await mutate((current) => current.filter((note) => note.id !== id));
      await enqueue(makeOp('note.purge', { noteId: id }));
    },
    [mutate]
  );

  const emptyTrash = useCallback(async (): Promise<void> => {
    const ids = notesRef.current.filter(isTrashed).map((note) => note.id);
    if (ids.length === 0) return;
    await mutate((current) => current.filter((note) => !ids.includes(note.id)));
    for (const id of ids) {
      await enqueue(makeOp('note.purge', { noteId: id }));
    }
  }, [mutate]);

  // --- Local view state ----------------------------------------------------

  const setSearchQuery = useCallback((query: string) => setSearchQueryState(query), []);

  const setSort = useCallback((next: NoteSort) => {
    setSortState(next);
    AsyncStorage.setItem(SORT_KEY, next).catch(() => {});
  }, []);

  const setManualOrder = useCallback((ids: string[]) => {
    setManualOrderState(ids);
    AsyncStorage.setItem(MANUAL_ORDER_KEY, JSON.stringify(ids)).catch(() => {});
  }, []);

  // --- Derived views -------------------------------------------------------

  const notes = useMemo(
    () => sortNotes(allNotes.filter(isActive), sort),
    [allNotes, sort]
  );

  const archivedNotes = useMemo(
    () =>
      allNotes
        .filter(isArchived)
        .sort((a, b) => (b.archived_at ?? '').localeCompare(a.archived_at ?? '')),
    [allNotes]
  );

  const trashedNotes = useMemo(
    () =>
      allNotes
        .filter(isTrashed)
        .sort((a, b) => (b.deleted_at ?? '').localeCompare(a.deleted_at ?? '')),
    [allNotes]
  );

  const getNoteById = useCallback(
    (id: string) => allNotes.find((note) => note.id === id),
    [allNotes]
  );

  const filteredNotes = useMemo(() => {
    const base = (() => {
      if (!searchQuery.trim()) return notes;
      const q = searchQuery.toLowerCase();
      return notes.filter(
        (note) =>
          note.title.toLowerCase().includes(q) ||
          note.formatted_text.toLowerCase().includes(q) ||
          note.raw_transcription?.toLowerCase().includes(q)
      );
    })();

    if (sort !== 'manual' || manualOrder.length === 0) return base;

    // Apply manual order: known IDs first (in saved order), then new notes appended
    const orderMap = new Map(manualOrder.map((id, i) => [id, i]));
    const known = base
      .filter((n) => orderMap.has(n.id))
      .sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
    const newNotes = base.filter((n) => !orderMap.has(n.id));
    return [...known, ...newNotes];
  }, [notes, searchQuery, sort, manualOrder]);

  const syncNow = useCallback(() => runSync(), []);

  return (
    <NotesContext.Provider
      value={{
        notes,
        allNotes,
        archivedNotes,
        trashedNotes,
        loading,
        searchQuery,
        sort,
        manualOrder,
        filteredNotes,
        sync,
        getNoteById,
        fetchNotes: syncNow,
        syncNow,
        createNote,
        updateNote,
        deleteNote,
        archiveNote,
        unarchiveNote,
        trashNote,
        restoreNote,
        deleteNotePermanently,
        emptyTrash,
        setSearchQuery,
        setSort,
        setManualOrder,
      }}
    >
      {children}
    </NotesContext.Provider>
  );
};

export const useNotes = (): NotesContextType => {
  const context = useContext(NotesContext);
  if (context === undefined) {
    throw new Error('useNotes must be used within a NotesProvider');
  }
  return context;
};
