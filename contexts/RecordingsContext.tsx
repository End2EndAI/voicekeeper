import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { Recording } from '../types';
import * as recordingsService from '../services/recordings';
import { useAuth } from './AuthContext';

interface RecordingsContextType {
  recordings: Recording[];
  loading: boolean;
  saveRecording: (tempUri: string, durationMs: number) => Promise<Recording>;
  updateRecording: (id: string, patch: Partial<Recording>) => Promise<void>;
  deleteRecording: (id: string) => Promise<void>;
  refreshRecordings: () => Promise<void>;
}

const RecordingsContext = createContext<RecordingsContextType | undefined>(undefined);

export const RecordingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { session } = useAuth();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRecordings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await recordingsService.loadRecordings();
      setRecordings(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) {
      loadRecordings();
    } else {
      setRecordings([]);
      setLoading(false);
    }
  }, [session, loadRecordings]);

  const saveRecording = useCallback(
    async (tempUri: string, durationMs: number): Promise<Recording> => {
      const recording = await recordingsService.saveRecording(tempUri, durationMs);
      setRecordings((prev) => [recording, ...prev]);
      return recording;
    },
    []
  );

  const updateRecording = useCallback(
    async (id: string, patch: Partial<Recording>): Promise<void> => {
      const updated = await recordingsService.updateRecording(id, patch);
      setRecordings((prev) => prev.map((r) => (r.id === id ? updated : r)));
    },
    []
  );

  const deleteRecording = useCallback(async (id: string): Promise<void> => {
    await recordingsService.deleteRecording(id);
    setRecordings((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const refreshRecordings = useCallback(async (): Promise<void> => {
    const data = await recordingsService.loadRecordings();
    setRecordings(data);
  }, []);

  return (
    <RecordingsContext.Provider
      value={{
        recordings,
        loading,
        saveRecording,
        updateRecording,
        deleteRecording,
        refreshRecordings,
      }}
    >
      {children}
    </RecordingsContext.Provider>
  );
};

export const useRecordings = (): RecordingsContextType => {
  const ctx = useContext(RecordingsContext);
  if (!ctx) throw new Error('useRecordings must be used within RecordingsProvider');
  return ctx;
};
