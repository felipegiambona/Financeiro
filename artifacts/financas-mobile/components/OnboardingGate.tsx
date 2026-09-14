import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { OnboardingFlow, type OnboardingStep } from '@/components/OnboardingFlow';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useWallets } from '@/context/WalletContext';
import { useFinancialProfiles } from '@/context/FinancialProfileContext';
import { useColors } from '@/hooks/useColors';

type GateMode = 'checking' | 'onboarding' | 'app';

function isOnboardingStep(value: string | null): value is OnboardingStep {
  return value === 'name' || value === 'profile' || value === 'wallet' || value === 'goal' || value === 'limit' || value === 'card';
}

function initialStepForProfile(profileType: 'personal' | 'business'): OnboardingStep {
  return profileType === 'business' ? 'wallet' : 'name';
}

function normalizeStepForProfile(step: OnboardingStep, profileType: 'personal' | 'business'): OnboardingStep {
  if (profileType === 'business' && (step === 'name' || step === 'profile')) {
    return 'wallet';
  }
  return step;
}

function storageKeys(userId: string, profileId: string) {
  const prefix = `financas-mobile:onboarding:${userId}:${profileId}`;
  return {
    complete: `${prefix}:complete`,
    started: `${prefix}:started`,
    step: `${prefix}:step`,
  };
}

export function OnboardingGate({ children }: React.PropsWithChildren) {
  const colors = useColors();
  const { session } = useAuth();
  const { setOnboardingActive } = useTheme();
  const { wallets, loading: walletsLoading } = useWallets();
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
    void AsyncStorage.multiGet([keys.complete, keys.started, keys.step]).then(async (entries) => {
      if (!active) return;
      const values = new Map(entries);
      const shouldStartOnboarding = wallets.length === 0 || hasAutomaticPlaceholder;
      if (!shouldStartOnboarding && values.get(keys.complete) === 'true') {
        setMode('app');
        return;
      }
      if (values.get(keys.started) === 'true') {
        const storedStep = values.get(keys.step) ?? null;
        const fallbackStep = wallets.length === 0 ? initialStepForProfile(activeProfile.type) : 'wallet';
        const savedStep = isOnboardingStep(storedStep) ? storedStep : fallbackStep;
        const normalizedStep = normalizeStepForProfile(savedStep, activeProfile.type);
        const resumedStep = normalizedStep === 'wallet' && wallets.length > 0 ? 'goal' : normalizedStep;
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
  }, [activeProfile?.id, hasAutomaticPlaceholder, session?.userId, wallets.length, walletsLoading]);

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
    void AsyncStorage.multiSet([[keys.complete, 'true'], [keys.started, 'false']])
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
    return <OnboardingFlow initialStep={step} onStepChange={handleStepChange} onComplete={handleComplete} />;
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});