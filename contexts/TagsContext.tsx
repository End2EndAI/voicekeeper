import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { Tag } from '../types';
import * as tagsService from '../services/tags';
import { useAuth } from './AuthContext';

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
}

const TagsContext = createContext<TagsContextType | undefined>(undefined);

export const TagsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { session } = useAuth();
  const [tags, setTags] = useState<Tag[]>([]);
  const [noteTagsMap, setNoteTagsMap] = useState<Record<string, Tag[]>>({});
  const [loading, setLoading] = useState(false);

  const refreshNoteTagsMap = useCallback(async () => {
    try {
      const map = await tagsService.fetchNoteTagsMap();
      setNoteTagsMap(map);
    } catch (error) {
      console.error('Failed to fetch note tags map:', error);
    }
  }, []);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tagsService.fetchTags();
      setTags(data);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) {
      fetchTags();
      refreshNoteTagsMap();
    } else {
      setTags([]);
      setNoteTagsMap({});
    }
  }, [session, fetchTags, refreshNoteTagsMap]);

  const createTag = useCallback(async (name: string, color: string): Promise<Tag> => {
    const tag = await tagsService.createTag(name, color);
    setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
    return tag;
  }, []);

  const updateTag = useCallback(
    async (id: string, name: string, color: string): Promise<Tag> => {
      const updated = await tagsService.updateTag(id, name, color);
      setTags((prev) =>
        prev.map((t) => (t.id === id ? updated : t)).sort((a, b) => a.name.localeCompare(b.name))
      );
      return updated;
    },
    []
  );

  const deleteTag = useCallback(async (id: string): Promise<void> => {
    await tagsService.deleteTag(id);
    setTags((prev) => prev.filter((t) => t.id !== id));
    setNoteTagsMap((prev) => {
      const next = { ...prev };
      for (const noteId of Object.keys(next)) {
        next[noteId] = next[noteId].filter((t) => t.id !== id);
      }
      return next;
    });
  }, []);

  const addTagToNote = useCallback(
    async (noteId: string, tagId: string): Promise<void> => {
      await tagsService.addTagToNote(noteId, tagId);
      const tag = tags.find((t) => t.id === tagId);
      if (tag) {
        setNoteTagsMap((prev) => ({
          ...prev,
          [noteId]: [...(prev[noteId] ?? []).filter((t) => t.id !== tagId), tag],
        }));
      }
    },
    [tags]
  );

  const removeTagFromNote = useCallback(
    async (noteId: string, tagId: string): Promise<void> => {
      await tagsService.removeTagFromNote(noteId, tagId);
      setNoteTagsMap((prev) => ({
        ...prev,
        [noteId]: (prev[noteId] ?? []).filter((t) => t.id !== tagId),
      }));
    },
    []
  );

  const fetchTagsForNote = useCallback(
    async (noteId: string): Promise<Tag[]> => {
      return tagsService.fetchTagsForNote(noteId);
    },
    []
  );

  return (
    <TagsContext.Provider
      value={{
        tags,
        noteTagsMap,
        loading,
        fetchTags,
        refreshNoteTagsMap,
        createTag,
        updateTag,
        deleteTag,
        addTagToNote,
        removeTagFromNote,
        fetchTagsForNote,
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
