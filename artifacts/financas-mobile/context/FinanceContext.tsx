import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import {
  createTransaction as persistTransaction,
  clearTransactions as clearPersistedTransactions,
  deleteTransaction as removePersistedTransaction,
  deleteTransactions as removePersistedTransactions,
  getTransactions,
  updateTransactions as updatePersistedTransactions,
  updateTransaction as updatePersistedTransaction,
  updateTransactionOccurrencePaymentStatus as updatePersistedOccurrencePaymentStatus,
} from '@/services/transactionRepository';
import {
  NewTransactionInput,
  PaymentStatus,
  Transaction,
} from '@/types/transaction';
import {
  acknowledgeNotificationTransactions,
  clearPendingNotificationTransactions,
  getPendingNotificationTransactions,
  isNotificationListenerAvailable,
  isNotificationListenerEnabled,
  normalizeNotificationType,
  openNotificationListenerSettings,
} from '@/services/notificationListener';

const NOTIFICATION_IMPORT_ENABLED_KEY = '@financas-mobile/notification-import-enabled';

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
  updateTransactions: (ids: string[], updates: {
    walletId?: string;
    categoryId?: string | null;
    dueDate?: string | null;
    paymentStatus?: PaymentStatus;
  }) => Promise<void>;
  clearTransactions: () => Promise<void>;
  notificationListenerAvailable: boolean;
  notificationAccessEnabled: boolean;
  notificationImportEnabled: boolean;
  refreshNotificationAccess: () => Promise<void>;
  openNotificationSettings: () => Promise<boolean>;
  setNotificationImportEnabled: (enabled: boolean) => Promise<void>;
  clearPendingNotifications: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: React.PropsWithChildren) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notificationAccessEnabled, setNotificationAccessEnabled] = useState(false);
  const [notificationImportEnabled, setNotificationImportEnabledState] = useState(false);
  const notificationSyncInFlight = useRef(false);
  const notificationListenerAvailable = isNotificationListenerAvailable();

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

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(NOTIFICATION_IMPORT_ENABLED_KEY).then((value) => {
      if (active) setNotificationImportEnabledState(value === 'true');
    });
    return () => {
      active = false;
    };
  }, []);

  const refreshNotificationAccess = useCallback(async () => {
    if (Platform.OS !== 'android' || !notificationListenerAvailable) {
      setNotificationAccessEnabled(false);
      return;
    }
    try {
      setNotificationAccessEnabled(await isNotificationListenerEnabled());
    } catch {
      setNotificationAccessEnabled(false);
    }
  }, [notificationListenerAvailable]);

  useEffect(() => {
    void refreshNotificationAccess();
  }, [refreshNotificationAccess]);

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

  const updateTransactions = useCallback(async (
    ids: string[],
    updates: {
      walletId?: string;
      categoryId?: string | null;
      dueDate?: string | null;
      paymentStatus?: PaymentStatus;
    },
  ) => {
    await updatePersistedTransactions(ids, updates);
    await reloadTransactions();
  }, [reloadTransactions]);

  const clearTransactions = useCallback(async () => {
    await clearPersistedTransactions();
    setTransactions([]);
  }, []);

  const openNotificationSettings = useCallback(
    () => openNotificationListenerSettings(),
    [],
  );

  const setNotificationImportEnabled = useCallback(async (enabled: boolean) => {
    setNotificationImportEnabledState(enabled);
    await AsyncStorage.setItem(NOTIFICATION_IMPORT_ENABLED_KEY, String(enabled));
  }, []);

  const clearPendingNotifications = useCallback(async () => {
    await clearPendingNotificationTransactions();
  }, []);

  const syncNotificationTransactions = useCallback(async () => {
    if (
      Platform.OS !== 'android'
      || !notificationListenerAvailable
      || !notificationAccessEnabled
      || !notificationImportEnabled
      || notificationSyncInFlight.current
    ) return;

    notificationSyncInFlight.current = true;
    try {
      const pending = await getPendingNotificationTransactions();
      const acknowledgedIds: string[] = [];
      for (const candidate of pending) {
        try {
          await persistTransaction({
            type: normalizeNotificationType(candidate.type),
            amount: candidate.amount,
            description: candidate.description,
            date: candidate.date,
            dueDate: null,
            recurrence: { kind: 'none' },
            paymentStatus: 'paid',
          });
          acknowledgedIds.push(candidate.id);
        } catch {
          break;
        }
      }
      if (acknowledgedIds.length > 0) {
        await acknowledgeNotificationTransactions(acknowledgedIds);
        await reloadTransactions();
      }
    } catch {
      setError('Não foi possível importar lançamentos das notificações.');
    } finally {
      notificationSyncInFlight.current = false;
    }
  }, [
    notificationAccessEnabled,
    notificationImportEnabled,
    notificationListenerAvailable,
    reloadTransactions,
  ]);

  useEffect(() => {
    if (!loading) void syncNotificationTransactions();
  }, [loading, syncNotificationTransactions]);

  useEffect(() => {
    if (
      Platform.OS !== 'android'
      || !notificationListenerAvailable
      || !notificationImportEnabled
    ) return undefined;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void refreshNotificationAccess();
        void syncNotificationTransactions();
      }
    });
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void syncNotificationTransactions();
    }, 15000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [
    notificationImportEnabled,
    notificationListenerAvailable,
    refreshNotificationAccess,
    syncNotificationTransactions,
  ]);

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
      updateTransactions,
      clearTransactions,
      notificationListenerAvailable,
      notificationAccessEnabled,
      notificationImportEnabled,
      refreshNotificationAccess,
      openNotificationSettings,
      setNotificationImportEnabled,
      clearPendingNotifications,
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
      updateTransactions,
      clearTransactions,
      notificationListenerAvailable,
      notificationAccessEnabled,
      notificationImportEnabled,
      refreshNotificationAccess,
      openNotificationSettings,
      setNotificationImportEnabled,
      clearPendingNotifications,
    ],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const context = useContext(FinanceContext);
  if (!context) throw new Error('useFinance deve ser usado dentro de FinanceProvider.');
  return context;
}