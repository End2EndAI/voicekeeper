import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { Note, CreateNoteInput, UpdateNoteInput, NoteSort } from '../types';
import * as notesService from '../services/notes';
import { useAuth } from './AuthContext';

interface NotesState {
  notes: Note[];
  loading: boolean;
  searchQuery: string;
  sort: NoteSort;
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
  });

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
  }, []);

  const filteredNotes = useMemo(() => {
    if (!state.searchQuery.trim()) return state.notes;
    const q = state.searchQuery.toLowerCase();
    return state.notes.filter(
      (note) =>
        note.title.toLowerCase().includes(q) ||
        note.formatted_text.toLowerCase().includes(q) ||
        note.raw_transcription?.toLowerCase().includes(q)
    );
  }, [state.notes, state.searchQuery]);

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
