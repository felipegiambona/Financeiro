import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createLimit as persistLimit,
  deleteLimit as removeLimit,
  getLimits,
  updateLimit as updatePersistedLimit,
} from '@/services/limitRepository';
import type { Limit, LimitUpdate, NewLimitInput } from '@/types/limit';

interface LimitContextValue {
  limits: Limit[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createLimit: (input: NewLimitInput) => Promise<Limit>;
  updateLimit: (id: string, updates: LimitUpdate) => Promise<Limit>;
  deleteLimit: (id: string) => Promise<void>;
}

const LimitContext = createContext<LimitContextValue | null>(null);

export function LimitProvider({ children }: React.PropsWithChildren) {
  const [limits, setLimits] = useState<Limit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      setLimits(await getLimits());
    } catch {
      setError('Não foi possível carregar seus limites.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createLimit = useCallback(async (input: NewLimitInput) => {
    try {
      setError(null);
      const created = await persistLimit(input);
      await refresh();
      return created;
    } catch {
      setError('Não foi possível salvar o limite.');
      throw new Error('Não foi possível salvar o limite.');
    }
  }, [refresh]);

  const updateLimit = useCallback(async (id: string, updates: LimitUpdate) => {
    try {
      setError(null);
      const updated = await updatePersistedLimit(id, updates);
      await refresh();
      return updated;
    } catch {
      setError('Não foi possível atualizar o limite.');
      throw new Error('Não foi possível atualizar o limite.');
    }
  }, [refresh]);

  const deleteLimit = useCallback(async (id: string) => {
    try {
      setError(null);
      await removeLimit(id);
      await refresh();
    } catch {
      setError('Não foi possível excluir o limite.');
      throw new Error('Não foi possível excluir o limite.');
    }
  }, [refresh]);

  const value = useMemo(
    () => ({ limits, loading, error, refresh, createLimit, updateLimit, deleteLimit }),
    [createLimit, deleteLimit, error, limits, loading, refresh, updateLimit],
  );

  return <LimitContext.Provider value={value}>{children}</LimitContext.Provider>;
}

export function useLimits(): LimitContextValue {
  const context = useContext(LimitContext);
  if (!context) throw new Error('useLimits deve ser usado dentro de LimitProvider.');
  return context;
}