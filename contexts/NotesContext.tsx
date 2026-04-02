import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Note, CreateNoteInput, UpdateNoteInput, NoteSort } from '../types';
import * as notesService from '../services/notes';
import { useAuth } from './AuthContext';

const SORT_KEY = '@voicekeeper/notes_sort';
const MANUAL_ORDER_KEY = '@voicekeeper/manual_order';

interface NotesState {
  notes: Note[];
  loading: boolean;
  searchQuery: string;
  sort: NoteSort;
  manualOrder: string[]; // note IDs in user-defined order
}

interface NotesContextType extends NotesState {
  filteredNotes: Note[];
  fetchNotes: () => Promise<void>;
  createNote: (input: CreateNoteInput) => Promise<Note>;
  updateNote: (id: string, updates: UpdateNoteInput) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  archiveNote: (id: string) => Promise<void>;
  unarchiveNote: (id: string) => Promise<void>;
  trashNote: (id: string) => Promise<void>;
  restoreNote: (id: string) => Promise<void>;
  deleteNotePermanently: (id: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSort: (sort: NoteSort) => void;
  setManualOrder: (ids: string[]) => void;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

export const NotesProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { session } = useAuth();
  const [state, setState] = useState<NotesState>({
    notes: [],
    loading: false,
    searchQuery: '',
    sort: 'date_desc',
    manualOrder: [],
  });

  // Restore persisted sort and manual order on mount
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(SORT_KEY),
      AsyncStorage.getItem(MANUAL_ORDER_KEY),
    ]).then(([savedSort, savedOrder]) => {
      setState((prev) => ({
        ...prev,
        ...(savedSort ? { sort: savedSort as NoteSort } : {}),
        ...(savedOrder ? { manualOrder: JSON.parse(savedOrder) as string[] } : {}),
      }));
    }).catch(() => {});
  }, []);

  const fetchNotes = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const notes = await notesService.fetchNotes(state.sort);
      setState((prev) => ({ ...prev, notes, loading: false }));
    } catch (error) {
      console.error('Failed to fetch notes:', error);
      setState((prev) => ({ ...prev, loading: false }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sort]);

  useEffect(() => {
    if (session) {
      fetchNotes();
    } else {
      setState({ notes: [], loading: false, searchQuery: '', sort: 'date_desc' });
    }
  }, [session, fetchNotes]);

  const createNote = useCallback(
    async (input: CreateNoteInput): Promise<Note> => {
      const note = await notesService.createNote(input);
      setState((prev) => ({
        ...prev,
        notes: [note, ...prev.notes],
      }));
      return note;
    },
    []
  );

  const updateNote = useCallback(
    async (id: string, updates: UpdateNoteInput) => {
      const updated = await notesService.updateNote(id, updates);
      setState((prev) => ({
        ...prev,
        notes: prev.notes.map((n) => (n.id === id ? updated : n)),
      }));
    },
    []
  );

  // Soft delete — envoie en corbeille
  const deleteNote = useCallback(async (id: string) => {
    // Optimistic update
    setState((prev) => ({
      ...prev,
      notes: prev.notes.filter((n) => n.id !== id),
    }));
    try {
      await notesService.trashNote(id);
    } catch (error) {
      // Revert on error
      fetchNotes();
      throw error;
    }
  }, [fetchNotes]);

  const archiveNote = useCallback(async (id: string) => {
    // Optimistic update — retire de la liste active
    setState((prev) => ({
      ...prev,
      notes: prev.notes.filter((n) => n.id !== id),
    }));
    try {
      await notesService.archiveNote(id);
    } catch (error) {
      fetchNotes();
      throw error;
    }
  }, [fetchNotes]);

  const unarchiveNote = useCallback(async (id: string) => {
    try {
      await notesService.unarchiveNote(id);
      // Rafraîchir la liste principale après désarchivage
      fetchNotes();
    } catch (error) {
      throw error;
    }
  }, [fetchNotes]);

  const trashNote = useCallback(async (id: string) => {
    try {
      await notesService.trashNote(id);
    } catch (error) {
      throw error;
    }
  }, []);

  const restoreNote = useCallback(async (id: string) => {
    try {
      await notesService.restoreNote(id);
    } catch (error) {
      throw error;
    }
  }, []);

  const deleteNotePermanently = useCallback(async (id: string) => {
    try {
      await notesService.deleteNotePermanently(id);
    } catch (error) {
      throw error;
    }
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setState((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  const setSort = useCallback((sort: NoteSort) => {
    setState((prev) => ({ ...prev, sort }));
    AsyncStorage.setItem(SORT_KEY, sort).catch(() => {});
  }, []);

  const setManualOrder = useCallback((ids: string[]) => {
    setState((prev) => ({ ...prev, manualOrder: ids }));
    AsyncStorage.setItem(MANUAL_ORDER_KEY, JSON.stringify(ids)).catch(() => {});
  }, []);

  const filteredNotes = useMemo(() => {
    const base = (() => {
      if (!state.searchQuery.trim()) return state.notes;
      const q = state.searchQuery.toLowerCase();
      return state.notes.filter(
        (note) =>
          note.title.toLowerCase().includes(q) ||
          note.formatted_text.toLowerCase().includes(q) ||
          note.raw_transcription?.toLowerCase().includes(q)
      );
    })();

    if (state.sort !== 'manual' || state.manualOrder.length === 0) return base;

    // Apply manual order: known IDs first (in saved order), then new notes appended
    const orderMap = new Map(state.manualOrder.map((id, i) => [id, i]));
    const known = base
      .filter((n) => orderMap.has(n.id))
      .sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
    const newNotes = base.filter((n) => !orderMap.has(n.id));
    return [...known, ...newNotes];
  }, [state.notes, state.searchQuery, state.sort, state.manualOrder]);

  return (
    <NotesContext.Provider
      value={{
        ...state,
        filteredNotes,
        fetchNotes,
        createNote,
        updateNote,
        deleteNote,
        archiveNote,
        unarchiveNote,
        trashNote,
        restoreNote,
        deleteNotePermanently,
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
