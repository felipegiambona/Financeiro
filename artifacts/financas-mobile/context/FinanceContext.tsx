import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createTransaction as persistTransaction,
  deleteTransaction as removePersistedTransaction,
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
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: React.PropsWithChildren) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      setTransactions(await getTransactions());
    } catch {
      setError('Não foi possível carregar seus lançamentos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createTransaction = useCallback(async (input: NewTransactionInput) => {
    try {
      setError(null);
      const created = await persistTransaction(input);
      setTransactions((current) => [created, ...current]);
    } catch {
      setError('Não foi possível salvar o lançamento.');
      throw new Error('Não foi possível salvar o lançamento.');
    }
  }, []);

  const updateTransaction = useCallback(async (id: string, updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>) => {
    const updated = await updatePersistedTransaction(id, updates);
    setTransactions((current) => current.map((item) => item.id === id ? updated : item));
  }, []);

  const updateTransactionOccurrencePaymentStatus = useCallback(async (
    id: string,
    occurrenceDate: string,
    paymentStatus: PaymentStatus,
  ) => {
    const updated = await updatePersistedOccurrencePaymentStatus(id, occurrenceDate, paymentStatus);
    setTransactions((current) => current.map((item) => item.id === id ? updated : item));
  }, []);

  const deleteTransaction = useCallback(async (id: string) => {
    await removePersistedTransaction(id);
    setTransactions((current) => current.filter((item) => item.id !== id));
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
    ],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const context = useContext(FinanceContext);
  if (!context) throw new Error('useFinance deve ser usado dentro de FinanceProvider.');
  return context;
}