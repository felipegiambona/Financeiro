import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Feather } from '@expo/vector-icons';

export const DASHBOARD_CARD_OPTIONS = [
  {
    id: 'balance',
    title: 'Saldo atual',
    description: 'Veja o saldo consolidado das suas carteiras.',
    icon: 'bar-chart-2',
  },
  {
    id: 'monthlySummary',
    title: 'Resumo do mês',
    description: 'Acompanhe receitas e despesas do mês.',
    icon: 'trending-up',
  },
  {
    id: 'pending',
    title: 'A receber e A pagar',
    description: 'Consulte os lançamentos ainda pendentes.',
    icon: 'clock',
  },
  {
    id: 'wallets',
    title: 'Carteiras',
    description: 'Visualize os saldos das suas carteiras.',
    icon: 'briefcase',
  },
  {
    id: 'limits',
    title: 'Meus limites',
    description: 'Acompanhe o uso dos seus limites de gastos.',
    icon: 'target',
  },
  {
    id: 'goals',
    title: 'Metas e objetivos',
    description: 'Acompanhe o progresso dos seus objetivos financeiros.',
    icon: 'award',
  },
] as const satisfies ReadonlyArray<{
  id: string;
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Feather>['name'];
}>;

export type DashboardCardId = (typeof DASHBOARD_CARD_OPTIONS)[number]['id'];
export type DashboardCardVisibility = Record<DashboardCardId, boolean>;

const DASHBOARD_PREFERENCES_KEY = '@financas-mobile/dashboard-card-visibility';

const DEFAULT_VISIBILITY: DashboardCardVisibility = {
  balance: true,
  monthlySummary: true,
  pending: true,
  wallets: true,
  limits: true,
  goals: true,
};

function parseVisibility(value: string | null): DashboardCardVisibility {
  if (!value) return DEFAULT_VISIBILITY;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      balance: typeof parsed.balance === 'boolean' ? parsed.balance : DEFAULT_VISIBILITY.balance,
      monthlySummary: typeof parsed.monthlySummary === 'boolean' ? parsed.monthlySummary : DEFAULT_VISIBILITY.monthlySummary,
      pending: typeof parsed.pending === 'boolean' ? parsed.pending : DEFAULT_VISIBILITY.pending,
      wallets: typeof parsed.wallets === 'boolean' ? parsed.wallets : DEFAULT_VISIBILITY.wallets,
      limits: typeof parsed.limits === 'boolean' ? parsed.limits : DEFAULT_VISIBILITY.limits,
      goals: typeof parsed.goals === 'boolean' ? parsed.goals : DEFAULT_VISIBILITY.goals,
    };
  } catch {
    return DEFAULT_VISIBILITY;
  }
}

interface DashboardPreferencesContextValue {
  visibility: DashboardCardVisibility;
  loaded: boolean;
  toggleCard: (id: DashboardCardId) => Promise<void>;
  resetVisibility: () => Promise<void>;
}

const DashboardPreferencesContext = createContext<DashboardPreferencesContextValue | null>(null);

export function DashboardPreferencesProvider({ children }: React.PropsWithChildren) {
  const [visibility, setVisibility] = useState<DashboardCardVisibility>(DEFAULT_VISIBILITY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(DASHBOARD_PREFERENCES_KEY)
      .then((stored) => {
        if (!active) return;
        setVisibility(parseVisibility(stored));
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const toggleCard = useCallback(async (id: DashboardCardId) => {
    setVisibility((current) => {
      const next = { ...current, [id]: !current[id] };
      void AsyncStorage.setItem(DASHBOARD_PREFERENCES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetVisibility = useCallback(async () => {
    setVisibility(DEFAULT_VISIBILITY);
    await AsyncStorage.setItem(DASHBOARD_PREFERENCES_KEY, JSON.stringify(DEFAULT_VISIBILITY));
  }, []);

  const value = useMemo(
    () => ({ visibility, loaded, toggleCard, resetVisibility }),
    [loaded, resetVisibility, toggleCard, visibility],
  );

  return <DashboardPreferencesContext.Provider value={value}>{children}</DashboardPreferencesContext.Provider>;
}

export function useDashboardPreferences(): DashboardPreferencesContextValue {
  const context = useContext(DashboardPreferencesContext);
  if (!context) throw new Error('useDashboardPreferences deve ser usado dentro de DashboardPreferencesProvider.');
  return context;
}