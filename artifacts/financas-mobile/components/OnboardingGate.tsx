import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { OnboardingFlow, type OnboardingStep } from '@/components/OnboardingFlow';
import { useAuth } from '@/context/AuthContext';
import { useWallets } from '@/context/WalletContext';
import { useColors } from '@/hooks/useColors';

type GateMode = 'checking' | 'onboarding' | 'app';

function isOnboardingStep(value: string | null): value is OnboardingStep {
  return value === 'wallet' || value === 'goal' || value === 'limit' || value === 'card';
}

function storageKeys(userId: string) {
  const prefix = `financas-mobile:onboarding:${userId}`;
  return {
    complete: `${prefix}:complete`,
    started: `${prefix}:started`,
    step: `${prefix}:step`,
  };
}

export function OnboardingGate({ children }: React.PropsWithChildren) {
  const colors = useColors();
  const { session } = useAuth();
  const { wallets, loading: walletsLoading } = useWallets();
  const [mode, setMode] = useState<GateMode>('checking');
  const [step, setStep] = useState<OnboardingStep>('wallet');
  const hasAutomaticPlaceholder = wallets.length === 1
    && wallets[0].isDefault
    && wallets[0].title === 'Carteira padrão'
    && wallets[0].initialBalance === 0;

  useEffect(() => {
    if (!session?.userId || walletsLoading) return;
    let active = true;
    const keys = storageKeys(session.userId);
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
        const savedStep = isOnboardingStep(storedStep) ? storedStep : 'wallet';
        const resumedStep = savedStep === 'wallet' && wallets.length > 0 ? 'goal' : savedStep;
        if (resumedStep !== savedStep) {
          await AsyncStorage.setItem(keys.step, resumedStep);
        }
        setStep(resumedStep);
        setMode('onboarding');
        return;
      }
      if (shouldStartOnboarding) {
        await AsyncStorage.multiSet([[keys.started, 'true'], [keys.step, 'wallet']]);
        if (active) setMode('onboarding');
        return;
      }
      if (wallets.length > 0) {
        await AsyncStorage.setItem(keys.complete, 'true');
        if (active) setMode('app');
        return;
      }
    }).catch(() => {
      if (active) setMode(wallets.length > 0 && !hasAutomaticPlaceholder ? 'app' : 'onboarding');
    });
    return () => {
      active = false;
    };
  }, [hasAutomaticPlaceholder, session?.userId, wallets.length, walletsLoading]);

  const handleStepChange = (nextStep: OnboardingStep) => {
    if (!session?.userId) return;
    const keys = storageKeys(session.userId);
    setStep(nextStep);
    void AsyncStorage.multiSet([[keys.started, 'true'], [keys.step, nextStep]]);
  };

  const handleComplete = () => {
    if (!session?.userId) return;
    const keys = storageKeys(session.userId);
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