import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useFinance } from '@/context/FinanceContext';
import { useFinancialProfiles } from '@/context/FinancialProfileContext';
import { useWallets } from '@/context/WalletContext';
import {
  acknowledgeAndroidNotifications,
  androidNotificationListenerSupported,
  getNotificationListenerStatus,
  getPendingAndroidNotifications,
  openNotificationListenerSettings,
  setNotificationListenerEnabled,
  setNotificationListenerPackages,
  type AndroidNotificationEvent,
  type NotificationListenerStatus,
} from '@/services/notificationListener';
import { parseNotificationTransaction, type ParsedNotificationTransaction } from '@/services/notificationTransactionParser';
import { DEFAULT_NOTIFICATION_PACKAGES, normalizeNotificationPackages } from '@/services/notificationPackages';

export type NotificationApprovalResult =
  | 'created'
  | 'duplicate'
  | 'unauthorized'
  | 'unrecognized'
  | 'missing-profile'
  | 'missing-wallet'
  | 'error';

interface NotificationAutomationContextValue {
  status: NotificationListenerStatus;
  enabled: boolean;
  pendingNotifications: AndroidNotificationEvent[];
  busy: boolean;
  message: string | null;
  setEnabled: (enabled: boolean) => Promise<void>;
  approveNotification: (eventId: string) => Promise<NotificationApprovalResult>;
  rejectNotification: (eventId: string) => Promise<void>;
  openSettings: () => Promise<void>;
  refresh: () => Promise<NotificationListenerStatus>;
}

const NotificationAutomationContext = createContext<NotificationAutomationContextValue | null>(null);

function settingKey(userId: string, suffix: string): string {
  return `financas-mobile:notification-automation:${userId}:${suffix}`;
}

function processedKey(userId: string): string {
  return settingKey(userId, 'processed');
}

async function readProcessed(userId: string): Promise<Set<string>> {
  const value = await AsyncStorage.getItem(processedKey(userId));
  try {
    const parsed = value ? JSON.parse(value) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}

async function saveProcessed(userId: string, processed: Set<string>): Promise<void> {
  const values = Array.from(processed).slice(-500);
  await AsyncStorage.setItem(processedKey(userId), JSON.stringify(values));
}

export function NotificationAutomationProvider({ children }: React.PropsWithChildren) {
  const { session } = useAuth();
  const { createTransaction } = useFinance();
  const { activeProfile } = useFinancialProfiles();
  const { wallets, loading: walletsLoading } = useWallets();
  const [status, setStatus] = useState<NotificationListenerStatus>({
    supported: androidNotificationListenerSupported,
    enabled: false,
    listenerAccessGranted: false,
    pendingCount: 0,
    allowedPackages: [],
  });
  const [enabled, setEnabledState] = useState(false);
  const [allowedPackages, setAllowedPackagesState] = useState<string[]>([]);
  const [pendingNotifications, setPendingNotifications] = useState<AndroidNotificationEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const processing = useRef(false);
  const loadedUserId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const [nextStatus, nextEvents] = await Promise.all([
      getNotificationListenerStatus(),
      getPendingAndroidNotifications(),
    ]);
    setStatus(nextStatus);
    setPendingNotifications(nextEvents);
    return nextStatus;
  }, []);

  useEffect(() => {
    if (!session?.userId) {
      loadedUserId.current = null;
      setEnabledState(false);
      setAllowedPackagesState([]);
      setPendingNotifications([]);
      setMessage(null);
      return;
    }
    let mounted = true;
    loadedUserId.current = null;
    void Promise.all([
      AsyncStorage.getItem(settingKey(session.userId, 'enabled')),
      AsyncStorage.getItem(settingKey(session.userId, 'packages')),
      getNotificationListenerStatus(),
      getPendingAndroidNotifications(),
    ]).then(async ([storedEnabled, storedPackages, nextStatus, nextEvents]) => {
      if (!mounted) return;
      const nextEnabled = storedEnabled === 'true' && nextStatus.enabled;
      let nextPackages: unknown = DEFAULT_NOTIFICATION_PACKAGES;
      if (storedPackages !== null) {
        try {
          nextPackages = JSON.parse(storedPackages);
        } catch {
          nextPackages = DEFAULT_NOTIFICATION_PACKAGES;
        }
      }
      const normalizedPackages = Array.isArray(nextPackages)
        ? normalizeNotificationPackages(nextPackages)
        : normalizeNotificationPackages(DEFAULT_NOTIFICATION_PACKAGES);
      await setNotificationListenerPackages(normalizedPackages);
      if (!mounted) return;
      setEnabledState(nextEnabled);
      setAllowedPackagesState(normalizedPackages);
      setStatus({ ...nextStatus, allowedPackages: normalizedPackages });
      setPendingNotifications(nextEvents);
      loadedUserId.current = session.userId;
    }).catch(() => {
      if (mounted) setMessage('Não foi possível carregar a automação de notificações.');
    });
    return () => {
      mounted = false;
    };
  }, [session?.userId]);

  const setEnabled = useCallback(async (nextEnabled: boolean) => {
    if (!session?.userId) return;
    if (nextEnabled && !status.supported) {
      setMessage('A automação exige um APK Android de desenvolvimento; ela não funciona no Expo Go.');
      return;
    }
    setBusy(true);
    try {
      await setNotificationListenerEnabled(nextEnabled);
      await AsyncStorage.setItem(settingKey(session.userId, 'enabled'), String(nextEnabled));
      setEnabledState(nextEnabled);
      await refresh();
      setMessage(nextEnabled
        ? 'Automação ativada. Se necessário, conceda o acesso nas configurações do Android.'
        : 'Automação desativada. As notificações pendentes continuam disponíveis para análise.');
    } finally {
      setBusy(false);
    }
  }, [refresh, session?.userId, status.supported]);

  const openSettings = useCallback(async () => {
    await openNotificationListenerSettings();
    await refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const interval = setInterval(() => void refresh(), 10000);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void refresh();
      }
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [enabled, refresh]);

  const approveNotification = useCallback(async (eventId: string): Promise<NotificationApprovalResult> => {
    if (processing.current) return 'error';
    if (!session?.userId || loadedUserId.current !== session.userId) return 'error';
    if (!activeProfile?.id) return 'missing-profile';
    if (walletsLoading || wallets.length === 0) return 'missing-wallet';

    const event = pendingNotifications.find((item) => item.eventId === eventId);
    if (!event) return 'error';
    if (!allowedPackages.includes(event.packageName)) return 'unauthorized';

    const parsed: ParsedNotificationTransaction | null = parseNotificationTransaction(event);
    if (!parsed) return 'unrecognized';

    processing.current = true;
    setBusy(true);
    try {
      const processed = await readProcessed(session.userId);
      if (processed.has(event.eventId)) {
        await acknowledgeAndroidNotifications([event.eventId]);
        await refresh();
        return 'duplicate';
      }

      const wallet = wallets.find((item) => item.isDefault) ?? wallets[0];
      await createTransaction({
        sourceId: parsed.sourceId,
        walletId: wallet.id,
        type: parsed.type,
        amount: parsed.amount,
        description: parsed.description,
        date: parsed.date,
        recurrence: { kind: 'none' },
        paymentStatus: 'paid',
      });
      processed.add(parsed.sourceId);
      await saveProcessed(session.userId, processed);
      await acknowledgeAndroidNotifications([event.eventId]);
      await refresh();
      setMessage('Lançamento aprovado e criado no extrato.');
      return 'created';
    } catch {
      setMessage('Não foi possível criar o lançamento. A notificação continua pendente.');
      return 'error';
    } finally {
      setBusy(false);
      processing.current = false;
    }
  }, [activeProfile?.id, allowedPackages, createTransaction, pendingNotifications, refresh, session?.userId, wallets, walletsLoading]);

  const rejectNotification = useCallback(async (eventId: string): Promise<void> => {
    if (processing.current) return;
    processing.current = true;
    setBusy(true);
    try {
      await acknowledgeAndroidNotifications([eventId]);
      await refresh();
      setMessage('Notificação rejeitada e excluída.');
    } finally {
      setBusy(false);
      processing.current = false;
    }
  }, [refresh]);

  const value = useMemo(() => ({
    status,
    enabled,
    pendingNotifications,
    busy,
    message,
    setEnabled,
    approveNotification,
    rejectNotification,
    openSettings,
    refresh,
  }), [approveNotification, busy, enabled, message, openSettings, pendingNotifications, refresh, rejectNotification, setEnabled, status]);

  return <NotificationAutomationContext.Provider value={value}>{children}</NotificationAutomationContext.Provider>;
}

export function useNotificationAutomation(): NotificationAutomationContextValue {
  const context = useContext(NotificationAutomationContext);
  if (!context) throw new Error('useNotificationAutomation deve ser usado dentro de NotificationAutomationProvider.');
  return context;
}