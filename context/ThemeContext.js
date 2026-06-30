import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PALETTES, LIGHT } from '../constants/theme';
import { KEYS } from '../services/settingsService';

// Pure resolver: given the user's mode and the OS scheme, what do we render?
export function resolveScheme(mode, systemScheme) {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return systemScheme === 'dark' ? 'dark' : 'light'; // 'auto'
}

const ThemeContext = createContext({
  mode: 'auto',
  scheme: 'light',
  colors: LIGHT,
  setMode: () => {},
});

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null, live-updates
  const [mode, setModeState] = useState('auto');

  useEffect(() => {
    AsyncStorage.getItem(KEYS.THEME_MODE)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'auto') setModeState(saved);
      })
      .catch(() => {});
  }, []);

  const setMode = (next) => {
    setModeState(next);
    AsyncStorage.setItem(KEYS.THEME_MODE, next).catch(() => {});
  };

  const scheme = resolveScheme(mode, systemScheme);
  const value = useMemo(
    () => ({ mode, scheme, colors: PALETTES[scheme], setMode }),
    [mode, scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
