import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createGoal as persistGoal,
  deleteGoal as removeGoal,
  getGoals,
  updateGoal as updatePersistedGoal,
} from '@/services/goalRepository';
import type { Goal, GoalUpdate, NewGoalInput } from '@/types/goal';

interface GoalContextValue {
  goals: Goal[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createGoal: (input: NewGoalInput) => Promise<Goal>;
  updateGoal: (id: string, updates: GoalUpdate) => Promise<Goal>;
  deleteGoal: (id: string) => Promise<void>;
}

const GoalContext = createContext<GoalContextValue | null>(null);

export function GoalProvider({ children }: React.PropsWithChildren) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      setGoals(await getGoals());
    } catch {
      setError('Não foi possível carregar suas metas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createGoal = useCallback(async (input: NewGoalInput) => {
    try {
      setError(null);
      const created = await persistGoal(input);
      await refresh();
      return created;
    } catch {
      setError('Não foi possível salvar a meta.');
      throw new Error('Não foi possível salvar a meta.');
    }
  }, [refresh]);

  const updateGoal = useCallback(async (id: string, updates: GoalUpdate) => {
    try {
      setError(null);
      const updated = await updatePersistedGoal(id, updates);
      await refresh();
      return updated;
    } catch {
      setError('Não foi possível atualizar a meta.');
      throw new Error('Não foi possível atualizar a meta.');
    }
  }, [refresh]);

  const deleteGoal = useCallback(async (id: string) => {
    try {
      setError(null);
      await removeGoal(id);
      await refresh();
    } catch {
      setError('Não foi possível excluir a meta.');
      throw new Error('Não foi possível excluir a meta.');
    }
  }, [refresh]);

  const value = useMemo(
    () => ({ goals, loading, error, refresh, createGoal, updateGoal, deleteGoal }),
    [createGoal, deleteGoal, error, goals, loading, refresh, updateGoal],
  );

  return <GoalContext.Provider value={value}>{children}</GoalContext.Provider>;
}

export function useGoals(): GoalContextValue {
  const context = useContext(GoalContext);
  if (!context) throw new Error('useGoals deve ser usado dentro de GoalProvider.');
  return context;
}