import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { FormatType } from '../types';
import * as preferencesService from '../services/preferences';
import { useAuth } from './AuthContext';
import { DEFAULT_FORMAT } from '../constants/formats';

interface PreferencesState {
  defaultFormat: FormatType;
  loading: boolean;
}

interface PreferencesContextType extends PreferencesState {
  setDefaultFormat: (format: FormatType) => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(
  undefined
);

export const PreferencesProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { session } = useAuth();
  const [state, setState] = useState<PreferencesState>({
    defaultFormat: DEFAULT_FORMAT,
    loading: true,
  });

  useEffect(() => {
    if (session) {
      loadPreferences();
    } else {
      setState({ defaultFormat: DEFAULT_FORMAT, loading: false });
    }
  }, [session]);

  const loadPreferences = async () => {
    try {
      const prefs = await preferencesService.fetchPreferences();
      setState({
        defaultFormat: prefs?.default_format ?? DEFAULT_FORMAT,
        loading: false,
      });
    } catch (error) {
      console.error('Failed to load preferences:', error);
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  const setDefaultFormat = useCallback(async (format: FormatType) => {
    setState((prev) => ({ ...prev, defaultFormat: format }));
    try {
      await preferencesService.updateDefaultFormat(format);
    } catch (error) {
      // Revert on error
      setState((prev) => ({ ...prev, defaultFormat: DEFAULT_FORMAT }));
      throw error;
    }
  }, []);

  return (
    <PreferencesContext.Provider
      value={{
        ...state,
        setDefaultFormat,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = (): PreferencesContextType => {
  const context = useContext(PreferencesContext);
  if (context === undefined) {
    throw new Error(
      'usePreferences must be used within a PreferencesProvider'
    );
  }
  return context;
};
