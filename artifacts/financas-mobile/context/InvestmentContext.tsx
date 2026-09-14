import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createInvestment as persistInvestment,
  deleteInvestment as removeInvestment,
  listInvestments,
  refreshInvestmentQuotes as persistInvestmentQuotes,
  updateInvestment as updatePersistedInvestment,
  type Investment,
  type InvestmentInput,
  type InvestmentUpdate,
} from '@workspace/api-client-react';
import { useFinancialProfiles } from '@/context/FinancialProfileContext';

interface InvestmentContextValue {
  investments: Investment[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  refreshQuotes: () => Promise<void>;
  createInvestment: (input: InvestmentInput) => Promise<Investment>;
  updateInvestment: (id: string, updates: InvestmentUpdate) => Promise<Investment>;
  deleteInvestment: (id: string) => Promise<void>;
}

const InvestmentContext = createContext<InvestmentContextValue | null>(null);

export function InvestmentProvider({ children }: React.PropsWithChildren) {
  const { activeProfile } = useFinancialProfiles();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (activeProfile?.type !== 'personal') {
      setInvestments([]);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setLoading(true);
      const loaded = await listInvestments();
      setInvestments(loaded);
      if (loaded.some((investment) => investment.valuationMode === 'automatic')) {
        try {
          setInvestments(await persistInvestmentQuotes());
        } catch {
          // Quote provider outages are shown per asset; they should not hide the portfolio.
        }
      }
    } catch {
      setError('Não foi possível carregar seus investimentos.');
    } finally {
      setLoading(false);
    }
  }, [activeProfile?.type]);

  useEffect(() => {
    void refresh();
    if (activeProfile?.type !== 'personal') return undefined;
    const interval = setInterval(() => void refresh(), 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [activeProfile?.type, refresh]);

  const refreshQuotes = useCallback(async () => {
    try {
      setInvestments(await persistInvestmentQuotes());
    } catch {
      throw new Error('Não foi possível atualizar as cotações agora.');
    }
  }, []);

  const createInvestment = useCallback(async (input: InvestmentInput) => {
    try {
      setError(null);
      const created = await persistInvestment(input);
      setInvestments((current) => [...current, created]);
      return created;
    } catch {
      setError('Não foi possível salvar o investimento.');
      throw new Error('Não foi possível salvar o investimento.');
    }
  }, []);

  const updateInvestment = useCallback(async (id: string, updates: InvestmentUpdate) => {
    try {
      setError(null);
      const updated = await updatePersistedInvestment(id, updates);
      setInvestments((current) => current.map((investment) => investment.id === id ? updated : investment));
      return updated;
    } catch {
      setError('Não foi possível atualizar o investimento.');
      throw new Error('Não foi possível atualizar o investimento.');
    }
  }, []);

  const deleteInvestment = useCallback(async (id: string) => {
    try {
      setError(null);
      await removeInvestment(id);
      setInvestments((current) => current.filter((investment) => investment.id !== id));
    } catch {
      setError('Não foi possível excluir o investimento.');
      throw new Error('Não foi possível excluir o investimento.');
    }
  }, []);

  const value = useMemo(
    () => ({ investments, loading, error, refresh, refreshQuotes, createInvestment, updateInvestment, deleteInvestment }),
    [createInvestment, deleteInvestment, error, investments, loading, refresh, refreshQuotes, updateInvestment],
  );

  return <InvestmentContext.Provider value={value}>{children}</InvestmentContext.Provider>;
}

export function useInvestments(): InvestmentContextValue {
  const context = useContext(InvestmentContext);
  if (!context) throw new Error('useInvestments deve ser usado dentro de InvestmentProvider.');
  return context;
}