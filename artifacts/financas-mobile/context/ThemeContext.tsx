import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth as useClerkAuth } from '@clerk/expo';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

const THEME_MODE_KEY_PREFIX = '@financas-mobile/theme-mode:';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedColorScheme = 'light' | 'dark';

interface ThemeContextValue {
  themeMode: ThemeMode;
  resolvedColorScheme: ResolvedColorScheme;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setOnboardingActive: (active: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: React.PropsWithChildren) {
  const deviceColorScheme = useColorScheme() === 'light' ? 'light' : 'dark';
  const { isLoaded, isSignedIn, userId } = useClerkAuth();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [onboardingActive, setOnboardingActiveState] = useState(false);

  useEffect(() => {
    let active = true;
    setThemeModeState('system');
    if (!isLoaded || !isSignedIn || !userId) {
      return () => {
        active = false;
      };
    }

    void AsyncStorage.getItem(`${THEME_MODE_KEY_PREFIX}${userId}`).then((storedMode) => {
      if (!active) return;
      if (storedMode === 'light' || storedMode === 'dark' || storedMode === 'system') {
        setThemeModeState(storedMode);
      }
    });
    return () => {
      active = false;
    };
  }, [isLoaded, isSignedIn, userId]);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    if (!isSignedIn || !userId) return;
    await AsyncStorage.setItem(`${THEME_MODE_KEY_PREFIX}${userId}`, mode);
  }, [isSignedIn, userId]);

  const setOnboardingActive = useCallback((active: boolean) => {
    setOnboardingActiveState(active);
  }, []);

  const resolvedColorScheme: ResolvedColorScheme = onboardingActive || themeMode === 'system'
    ? deviceColorScheme
    : themeMode;
  const value = useMemo(
    () => ({ themeMode, resolvedColorScheme, setThemeMode, setOnboardingActive }),
    [resolvedColorScheme, setOnboardingActive, setThemeMode, themeMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme deve ser usado dentro de ThemeProvider.');
  return context;
}