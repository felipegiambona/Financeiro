import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createInvestmentDividend as persistInvestmentDividend,
  deleteInvestmentDividend as removeInvestmentDividend,
  getInvestmentDividendCalendar,
  importInvestmentDividends,
  listInvestmentDividends,
  updateInvestmentDividend as updatePersistedInvestmentDividend,
  type InvestmentDividendCalendar,
  type InvestmentDividendImportEvent,
  type InvestmentDividendImportResponse,
  type InvestmentDividend,
  type InvestmentDividendInput,
  type InvestmentDividendUpdate,
} from '@workspace/api-client-react';
import { useFinancialProfiles } from '@/context/FinancialProfileContext';

export type InvestmentDividendFormInput = Omit<InvestmentDividendInput, 'paymentDate'> & {
  paymentDate: string;
};
export type InvestmentDividendUpdateInput = Omit<InvestmentDividendUpdate, 'paymentDate' | 'note'> & {
  paymentDate?: string;
  note?: string | null;
};

interface DividendContextValue {
  dividends: InvestmentDividend[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getCalendar: () => Promise<InvestmentDividendCalendar>;
  importEvents: (events: InvestmentDividendImportEvent[]) => Promise<InvestmentDividendImportResponse>;
  createDividend: (input: InvestmentDividendFormInput) => Promise<InvestmentDividend>;
  updateDividend: (id: string, updates: InvestmentDividendUpdateInput) => Promise<InvestmentDividend>;
  deleteDividend: (id: string) => Promise<void>;
}

const DividendContext = createContext<DividendContextValue | null>(null);

export function DividendProvider({ children }: React.PropsWithChildren) {
  const { activeProfile } = useFinancialProfiles();
  const [dividends, setDividends] = useState<InvestmentDividend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (activeProfile?.type !== 'personal') {
      setDividends([]);
      setError(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setDividends(await listInvestmentDividends());
    } catch {
      setError('Não foi possível carregar seus proventos.');
    } finally {
      setLoading(false);
    }
  }, [activeProfile?.type]);

  const getCalendar = useCallback(async () => {
    if (activeProfile?.type !== 'personal') {
      return { source: 'BRAPI' as const, events: [], failures: [] };
    }
    return getInvestmentDividendCalendar();
  }, [activeProfile?.type]);

  const importEvents = useCallback(async (events: InvestmentDividendImportEvent[]) => {
    try {
      const result = await importInvestmentDividends({ events });
      if (result.created.length > 0) {
        setDividends((current) => [
          ...result.created,
          ...current.filter((currentDividend) => !result.created.some((created) => created.id === currentDividend.id)),
        ]);
      }
      return result;
    } catch {
      throw new Error('Não foi possível importar os proventos.');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createDividend = useCallback(async (input: InvestmentDividendFormInput) => {
    try {
      const created = await persistInvestmentDividend({
        ...input,
      });
      setDividends((current) => [created, ...current]);
      return created;
    } catch {
      setError('Não foi possível salvar o provento.');
      throw new Error('Não foi possível salvar o provento.');
    }
  }, []);

  const updateDividend = useCallback(async (id: string, updates: InvestmentDividendUpdateInput) => {
    try {
      const updated = await updatePersistedInvestmentDividend(id, {
        ...updates,
      } as InvestmentDividendUpdate);
      setDividends((current) => current.map((dividend) => dividend.id === id ? updated : dividend));
      return updated;
    } catch {
      setError('Não foi possível atualizar o provento.');
      throw new Error('Não foi possível atualizar o provento.');
    }
  }, []);

  const deleteDividend = useCallback(async (id: string) => {
    try {
      await removeInvestmentDividend(id);
      setDividends((current) => current.filter((dividend) => dividend.id !== id));
    } catch {
      setError('Não foi possível excluir o provento.');
      throw new Error('Não foi possível excluir o provento.');
    }
  }, []);

  const value = useMemo(
    () => ({ dividends, loading, error, refresh, getCalendar, importEvents, createDividend, updateDividend, deleteDividend }),
    [createDividend, deleteDividend, dividends, error, getCalendar, importEvents, loading, refresh, updateDividend],
  );

  return <DividendContext.Provider value={value}>{children}</DividendContext.Provider>;
}

export function useDividends(): DividendContextValue {
  const context = useContext(DividendContext);
  if (!context) throw new Error('useDividends deve ser usado dentro de DividendProvider.');
  return context;
}