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
  loading: boolean;
  fetchTags: () => Promise<void>;
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
  const [loading, setLoading] = useState(false);

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
    } else {
      setTags([]);
    }
  }, [session, fetchTags]);

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
  }, []);

  const addTagToNote = useCallback(
    async (noteId: string, tagId: string): Promise<void> => {
      await tagsService.addTagToNote(noteId, tagId);
    },
    []
  );

  const removeTagFromNote = useCallback(
    async (noteId: string, tagId: string): Promise<void> => {
      await tagsService.removeTagFromNote(noteId, tagId);
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
        loading,
        fetchTags,
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
