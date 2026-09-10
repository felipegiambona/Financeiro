import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ClerkLoaded, ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { setBaseUrl } from '@workspace/api-client-react';
import { FinanceProvider } from '@/context/FinanceContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { WalletProvider } from '@/context/WalletContext';
import { useColors } from '@/hooks/useColors';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
const domain = process.env.EXPO_PUBLIC_DOMAIN;
if (domain) setBaseUrl(`https://${domain}`);
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
const proxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;
if (!publishableKey) throw new Error('A autenticação não foi configurada.');

function RootLayoutNav() {
  const colors = useColors();
  const { session } = useAuth();
  return (
    <Stack screenOptions={{ headerBackTitle: 'Voltar', contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={Boolean(session)}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="transaction/new" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="more/profile" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="more/settings" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="wallets" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="notifications" options={{ headerShown: false, presentation: 'card' }} />
      </Stack.Protected>
    </Stack>
  );
}

function AuthenticatedApp() {
  const colors = useColors();
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.foreground} />
      </View>
    );
  }

  return session ? (
    <FinanceProvider>
      <WalletProvider>
        <RootLayoutNav />
      </WalletProvider>
    </FinanceProvider>
  ) : <RootLayoutNav />;
}

function ThemedApp() {
  const colors = useColors();
  const { resolvedColorScheme } = useTheme();
  const statusBarStyle = resolvedColorScheme === 'dark' ? 'light' : 'dark';
  const navigationBarStyle = resolvedColorScheme === 'dark' ? 'dark' : 'light';

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
    if (Platform.OS === 'android') {
      NavigationBar.setStyle(navigationBarStyle);
    }
  }, [colors.background, navigationBarStyle]);

  return (
    <View style={[styles.appShell, { backgroundColor: colors.background }]}>
      <StatusBar key={`status-bar-${resolvedColorScheme}`} style={statusBarStyle} animated />
      <NavigationBar
        key={`navigation-bar-${resolvedColorScheme}`}
        style={navigationBarStyle}
      />
      <ErrorBoundary>
        <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache} proxyUrl={proxyUrl}>
          <ClerkLoaded>
            <QueryClientProvider client={queryClient}>
              <GestureHandlerRootView style={[styles.root, { backgroundColor: colors.background }]}>
                <KeyboardProvider>
                  <AuthProvider>
                    <AuthenticatedApp />
                  </AuthProvider>
                </KeyboardProvider>
              </GestureHandlerRootView>
            </QueryClientProvider>
          </ClerkLoaded>
        </ClerkProvider>
      </ErrorBoundary>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
  },
  root: {
    flex: 1,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
