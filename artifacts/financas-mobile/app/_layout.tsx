import '@/utils/typographyScale';
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
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  useFonts,
} from '@expo-google-fonts/dm-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { setBaseUrl } from '@workspace/api-client-react';
import { FinanceProvider } from '@/context/FinanceContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { WalletProvider } from '@/context/WalletContext';
import { CategoryProvider } from '@/context/CategoryContext';
import { LimitProvider } from '@/context/LimitContext';
import { GoalProvider } from '@/context/GoalContext';
import { CardProvider } from '@/context/CardContext';
import { DashboardPreferencesProvider } from '@/context/DashboardPreferencesContext';
import { useColors } from '@/hooks/useColors';
import { OnboardingGate } from '@/components/OnboardingGate';
import { FinancialProfileProvider, useFinancialProfiles } from '@/context/FinancialProfileContext';
import { InvestmentProvider } from '@/context/InvestmentContext';
import { DividendProvider } from '@/context/DividendContext';

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
      <Stack.Screen name="legal/[document]" options={{ headerShown: false, presentation: 'card' }} />
      <Stack.Protected guard={Boolean(session)}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="transaction/new" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="more/profile" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="more/settings" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="more/privacy" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="more/categories" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="more/limits" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="more/goals" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="more/goal/[id]" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="more/cards" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="more/investments" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="more/card/[id]" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="more/dashboard-cards" options={{ headerShown: false, presentation: 'card' }} />
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
    <FinancialProfileProvider>
      <ProfileScopedProviders />
    </FinancialProfileProvider>
  ) : <RootLayoutNav />;
}

function ProfileScopedProviders() {
  const { activeProfile } = useFinancialProfiles();
  return (
    <React.Fragment key={activeProfile?.id ?? 'profile-loading'}>
    <FinanceProvider>
      <WalletProvider>
        <CategoryProvider>
          <LimitProvider>
            <GoalProvider>
              <CardProvider>
                <InvestmentProvider>
                  <DividendProvider>
                    <DashboardPreferencesProvider>
                      <OnboardingGate>
                        <RootLayoutNav />
                      </OnboardingGate>
                    </DashboardPreferencesProvider>
                  </DividendProvider>
                </InvestmentProvider>
              </CardProvider>
            </GoalProvider>
          </LimitProvider>
        </CategoryProvider>
      </WalletProvider>
    </FinanceProvider>
    </React.Fragment>
  );
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
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={[styles.root, { backgroundColor: colors.background }]}>
          <KeyboardProvider>
            <AuthProvider>
              <AuthenticatedApp />
            </AuthProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    // Keep the existing family keys so all screens switch together without
    // changing their style contracts one by one.
    Inter_400Regular: DMSans_400Regular,
    Inter_500Medium: DMSans_500Medium,
    Inter_600SemiBold: DMSans_600SemiBold,
    Inter_700Bold: DMSans_700Bold,
  });

  useEffect(() => {
    if (Platform.OS === 'web' || fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (Platform.OS !== 'web' && !fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache} proxyUrl={proxyUrl}>
          <ThemeProvider>
            <ThemedApp />
          </ThemeProvider>
        </ClerkProvider>
      </ErrorBoundary>
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
