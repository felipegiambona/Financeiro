import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createTransaction as persistTransaction,
  clearTransactions as clearPersistedTransactions,
  deleteTransaction as removePersistedTransaction,
  deleteTransactions as removePersistedTransactions,
  getTransactions,
  updateTransaction as updatePersistedTransaction,
  updateTransactionOccurrencePaymentStatus as updatePersistedOccurrencePaymentStatus,
} from '@/services/transactionRepository';
import {
  NewTransactionInput,
  PaymentStatus,
  Transaction,
} from '@/types/transaction';

interface FinanceContextValue {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createTransaction: (input: NewTransactionInput) => Promise<void>;
  updateTransaction: (id: string, updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>) => Promise<void>;
  updateTransactionOccurrencePaymentStatus: (id: string, occurrenceDate: string, paymentStatus: PaymentStatus) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  deleteTransactions: (ids: string[]) => Promise<void>;
  clearTransactions: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: React.PropsWithChildren) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reloadTransactions = useCallback(async () => {
    const nextTransactions = await getTransactions();
    setTransactions(nextTransactions);
    return nextTransactions;
  }, []);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      await reloadTransactions();
    } catch {
      setError('Não foi possível carregar seus lançamentos.');
    } finally {
      setLoading(false);
    }
  }, [reloadTransactions]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createTransaction = useCallback(async (input: NewTransactionInput) => {
    try {
      setError(null);
      await persistTransaction(input);
      await reloadTransactions();
    } catch {
      setError('Não foi possível salvar o lançamento.');
      throw new Error('Não foi possível salvar o lançamento.');
    }
  }, [reloadTransactions]);

  const updateTransaction = useCallback(async (id: string, updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>) => {
    await updatePersistedTransaction(id, updates);
    await reloadTransactions();
  }, [reloadTransactions]);

  const updateTransactionOccurrencePaymentStatus = useCallback(async (
    id: string,
    occurrenceDate: string,
    paymentStatus: PaymentStatus,
  ) => {
    await updatePersistedOccurrencePaymentStatus(id, occurrenceDate, paymentStatus);
    await reloadTransactions();
  }, [reloadTransactions]);

  const deleteTransaction = useCallback(async (id: string) => {
    await removePersistedTransaction(id);
    await reloadTransactions();
  }, [reloadTransactions]);

  const deleteTransactions = useCallback(async (ids: string[]) => {
    await removePersistedTransactions(ids);
    await reloadTransactions();
  }, [reloadTransactions]);

  const clearTransactions = useCallback(async () => {
    await clearPersistedTransactions();
    setTransactions([]);
  }, []);

  const value = useMemo(
    () => ({
      transactions,
      loading,
      error,
      refresh,
      createTransaction,
      updateTransaction,
      updateTransactionOccurrencePaymentStatus,
      deleteTransaction,
      deleteTransactions,
      clearTransactions,
    }),
    [
      transactions,
      loading,
      error,
      refresh,
      createTransaction,
      updateTransaction,
      updateTransactionOccurrencePaymentStatus,
      deleteTransaction,
      deleteTransactions,
      clearTransactions,
    ],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const context = useContext(FinanceContext);
  if (!context) throw new Error('useFinance deve ser usado dentro de FinanceProvider.');
  return context;
}