import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

const THEME_MODE_KEY = '@financas-mobile/theme-mode';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedColorScheme = 'light' | 'dark';

interface ThemeContextValue {
  themeMode: ThemeMode;
  resolvedColorScheme: ResolvedColorScheme;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: React.PropsWithChildren) {
  const deviceColorScheme = useColorScheme() === 'light' ? 'light' : 'dark';
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(THEME_MODE_KEY).then((storedMode) => {
      if (!active) return;
      if (storedMode === 'light' || storedMode === 'dark' || storedMode === 'system') {
        setThemeModeState(storedMode);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await AsyncStorage.setItem(THEME_MODE_KEY, mode);
  }, []);

  const resolvedColorScheme: ResolvedColorScheme = themeMode === 'system' ? deviceColorScheme : themeMode;
  const value = useMemo(
    () => ({ themeMode, resolvedColorScheme, setThemeMode }),
    [resolvedColorScheme, setThemeMode, themeMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme deve ser usado dentro de ThemeProvider.');
  return context;
}