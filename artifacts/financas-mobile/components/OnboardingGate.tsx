import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { OnboardingFlow } from '@/components/OnboardingFlow';
import {
  initialStepForProfile,
  resolveOnboardingStep,
  type OnboardingStep,
} from '@/components/onboardingState';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useWallets } from '@/context/WalletContext';
import { useFinancialProfiles } from '@/context/FinancialProfileContext';
import { useColors } from '@/hooks/useColors';

type GateMode = 'checking' | 'onboarding' | 'app';

function storageKeys(userId: string, profileId: string) {
  const prefix = `financas-mobile:onboarding:${userId}:${profileId}`;
  return {
    complete: `${prefix}:complete`,
    cancelled: `${prefix}:cancelled`,
    started: `${prefix}:started`,
    step: `${prefix}:step`,
  };
}

export function OnboardingGate({ children }: React.PropsWithChildren) {
  const colors = useColors();
  const { session } = useAuth();
  const { setOnboardingActive } = useTheme();
  const { wallets, loading: walletsLoading, error: walletsError } = useWallets();
  const { activeProfile } = useFinancialProfiles();
  const [mode, setMode] = useState<GateMode>('checking');
  const [step, setStep] = useState<OnboardingStep>('name');
  const hasAutomaticPlaceholder = wallets.length === 1
    && wallets[0].isDefault
    && wallets[0].title === 'Carteira padrão'
    && wallets[0].initialBalance === 0;

  useEffect(() => {
    const active = Boolean(session?.userId) && mode !== 'app';
    setOnboardingActive(active);
    return () => setOnboardingActive(false);
  }, [mode, session?.userId, setOnboardingActive]);

  useEffect(() => {
    if (!session?.userId || !activeProfile?.id || walletsLoading) return;
    let active = true;
    const keys = storageKeys(session.userId, activeProfile.id);
    void AsyncStorage.multiGet([keys.complete, keys.cancelled, keys.started, keys.step]).then(async (entries) => {
      if (!active) return;
      // An unavailable wallet request is not the same as a new profile. Keep
      // the app mounted so the profile-scoped screens can show their retry
      // state instead of replacing the whole app with onboarding.
      if (walletsError) {
        setMode('app');
        return;
      }
      const values = new Map(entries);
      const shouldStartOnboarding = wallets.length === 0 || hasAutomaticPlaceholder;
      if (values.get(keys.cancelled) === 'true') {
        setMode('app');
        return;
      }
      if (!shouldStartOnboarding && values.get(keys.complete) === 'true') {
        setMode('app');
        return;
      }
      if (values.get(keys.started) === 'true') {
        const storedStep = values.get(keys.step) ?? null;
        // Older builds could leave a personal profile marked as started after
        // its wallet had already been created. Those profiles are initialized
        // and must not reopen the name/profile screens when the user switches
        // back to them.
        if (
          activeProfile.type === 'personal'
          && wallets.length > 0
          && (storedStep === null || storedStep === 'name' || storedStep === 'profile')
        ) {
          await AsyncStorage.multiSet([[keys.complete, 'true'], [keys.started, 'false']]);
          if (active) setMode('app');
          return;
        }
        const resumedStep = resolveOnboardingStep({
          storedStep,
          profileType: activeProfile.type,
          walletCount: wallets.length,
        });
        if (resumedStep !== storedStep) {
          await AsyncStorage.setItem(keys.step, resumedStep);
        }
        setStep(resumedStep);
        setMode('onboarding');
        return;
      }
      if (shouldStartOnboarding) {
        const initialStep = initialStepForProfile(activeProfile.type);
        await AsyncStorage.multiSet([[keys.started, 'true'], [keys.step, initialStep]]);
        setStep(initialStep);
        if (active) setMode('onboarding');
        return;
      }
      if (wallets.length > 0) {
        await AsyncStorage.setItem(keys.complete, 'true');
        if (active) setMode('app');
        return;
      }
    }).catch(() => {
      if (active) {
        setStep(initialStepForProfile(activeProfile.type));
        setMode(wallets.length > 0 && !hasAutomaticPlaceholder ? 'app' : 'onboarding');
      }
    });
    return () => {
      active = false;
    };
  }, [activeProfile?.id, activeProfile?.type, hasAutomaticPlaceholder, session?.userId, wallets.length, walletsError, walletsLoading]);

  const handleStepChange = (nextStep: OnboardingStep) => {
    if (!session?.userId) return;
    if (!activeProfile?.id) return;
    const keys = storageKeys(session.userId, activeProfile.id);
    setStep(nextStep);
    void AsyncStorage.multiSet([[keys.started, 'true'], [keys.step, nextStep]]);
  };

  const handleComplete = () => {
    if (!session?.userId) return;
    if (!activeProfile?.id) return;
    const keys = storageKeys(session.userId, activeProfile.id);
    void AsyncStorage.multiSet([[keys.cancelled, 'false'], [keys.complete, 'true'], [keys.started, 'false']])
      .then(() => setMode('app'));
  };

  const handleCancel = () => {
    if (!session?.userId) return;
    if (!activeProfile?.id) return;
    const keys = storageKeys(session.userId, activeProfile.id);
    void AsyncStorage.multiSet([[keys.cancelled, 'true'], [keys.complete, 'false'], [keys.started, 'false']])
      .then(() => setMode('app'));
  };

  if (mode === 'checking') {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (mode === 'onboarding') {
    return (
      <OnboardingFlow
        initialStep={step}
        onStepChange={handleStepChange}
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    );
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});