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
  clearPendingAndroidNotifications,
  getNotificationListenerStatus,
  getPendingAndroidNotifications,
  openNotificationListenerSettings,
  setNotificationListenerEnabled,
  setNotificationListenerPackages,
  type NotificationListenerStatus,
} from '@/services/notificationListener';
import { parseNotificationTransaction } from '@/services/notificationTransactionParser';

interface NotificationAutomationContextValue {
  status: NotificationListenerStatus;
  enabled: boolean;
  allowedPackages: string[];
  pendingCount: number;
  busy: boolean;
  message: string | null;
  setEnabled: (enabled: boolean) => Promise<void>;
  setAllowedPackages: (packages: string[]) => Promise<void>;
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
  const [pendingCount, setPendingCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const processing = useRef(false);
  const loadedUserId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const nextStatus = await getNotificationListenerStatus();
    setStatus(nextStatus);
    setPendingCount(nextStatus.pendingCount);
    return nextStatus;
  }, []);

  useEffect(() => {
    if (!session?.userId) {
      loadedUserId.current = null;
      setEnabledState(false);
      setAllowedPackagesState([]);
      setPendingCount(0);
      setMessage(null);
      return;
    }
    let mounted = true;
    loadedUserId.current = null;
    void Promise.all([
      AsyncStorage.getItem(settingKey(session.userId, 'enabled')),
      AsyncStorage.getItem(settingKey(session.userId, 'packages')),
      getNotificationListenerStatus(),
    ]).then(([storedEnabled, storedPackages, nextStatus]) => {
      if (!mounted) return;
      const nextEnabled = storedEnabled === 'true' && nextStatus.enabled;
      let nextPackages: unknown = nextStatus.allowedPackages;
      if (storedPackages) {
        try {
          nextPackages = JSON.parse(storedPackages);
        } catch {
          nextPackages = nextStatus.allowedPackages;
        }
      }
      const normalizedPackages = Array.isArray(nextPackages)
        ? nextPackages.filter((item): item is string => typeof item === 'string' && item.length > 0)
        : [];
      setEnabledState(nextEnabled);
      setAllowedPackagesState(normalizedPackages);
      setStatus(nextStatus);
      setPendingCount(nextStatus.pendingCount);
      loadedUserId.current = session.userId;
    }).catch(() => {
      if (mounted) setMessage('Não foi possível carregar a automação de notificações.');
    });
    return () => {
      mounted = false;
    };
  }, [session?.userId]);

  const setAllowedPackages = useCallback(async (packages: string[]) => {
    if (!session?.userId) return;
    const normalizedPackages = Array.from(new Set(packages.map((item) => item.trim()).filter(Boolean)));
    setBusy(true);
    try {
      await setNotificationListenerPackages(normalizedPackages);
      await AsyncStorage.setItem(settingKey(session.userId, 'packages'), JSON.stringify(normalizedPackages));
      setAllowedPackagesState(normalizedPackages);
      await refresh();
      setMessage(normalizedPackages.length > 0 ? 'Aplicativos autorizados atualizados.' : 'Nenhum aplicativo foi selecionado.');
    } finally {
      setBusy(false);
    }
  }, [refresh, session?.userId]);

  const setEnabled = useCallback(async (nextEnabled: boolean) => {
    if (!session?.userId) return;
    if (nextEnabled && !status.supported) {
      setMessage('A automação exige um APK Android de desenvolvimento; ela não funciona no Expo Go.');
      return;
    }
    setBusy(true);
    try {
      await setNotificationListenerEnabled(nextEnabled);
      if (!nextEnabled) await clearPendingAndroidNotifications();
      await AsyncStorage.setItem(settingKey(session.userId, 'enabled'), String(nextEnabled));
      setEnabledState(nextEnabled);
      await refresh();
      setMessage(nextEnabled
        ? 'Automação ativada. Se necessário, conceda o acesso nas configurações do Android.'
        : 'Automação desativada.');
    } finally {
      setBusy(false);
    }
  }, [refresh, session?.userId, status.supported]);

  const processPending = useCallback(async () => {
    if (
      processing.current
      || !session?.userId
      || loadedUserId.current !== session.userId
      || !enabled
      || !activeProfile?.id
      || walletsLoading
      || wallets.length === 0
    ) return;
    processing.current = true;
    try {
      const events = await getPendingAndroidNotifications();
      setPendingCount(events.length);
      if (events.length === 0) return;
      const allowed = new Set(allowedPackages);
      const processed = await readProcessed(session.userId);
      const wallet = wallets.find((item) => item.isDefault) ?? wallets[0];
      const acknowledged: string[] = [];
      for (const event of events) {
        if (!allowed.has(event.packageName) || processed.has(event.eventId)) {
          acknowledged.push(event.eventId);
          continue;
        }
        const parsed = parseNotificationTransaction(event);
        if (!parsed) {
          acknowledged.push(event.eventId);
          setMessage('Uma notificação não reconhecida foi ignorada.');
          continue;
        }
        try {
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
          acknowledged.push(event.eventId);
          await saveProcessed(session.userId, processed);
          setMessage('Lançamento automático criado. Você pode editá-lo no extrato.');
        } catch {
          setMessage('Não foi possível salvar um lançamento automático; ele será tentado novamente.');
          break;
        }
      }
      if (acknowledged.length > 0) await acknowledgeAndroidNotifications(acknowledged);
      await refresh();
    } finally {
      processing.current = false;
    }
  }, [activeProfile?.id, allowedPackages, createTransaction, enabled, refresh, session?.userId, wallets, walletsLoading]);

  useEffect(() => {
    if (!enabled) return;
    void processPending();
    const interval = setInterval(() => void processPending(), 10000);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void refresh();
        void processPending();
      }
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [enabled, processPending, refresh]);

  const openSettings = useCallback(async () => {
    await openNotificationListenerSettings();
    await refresh();
  }, [refresh]);

  const value = useMemo(() => ({
    status,
    enabled,
    allowedPackages,
    pendingCount,
    busy,
    message,
    setEnabled,
    setAllowedPackages,
    openSettings,
    refresh,
  }), [allowedPackages, busy, enabled, message, openSettings, pendingCount, refresh, setAllowedPackages, setEnabled, status]);

  return <NotificationAutomationContext.Provider value={value}>{children}</NotificationAutomationContext.Provider>;
}

export function useNotificationAutomation(): NotificationAutomationContextValue {
  const context = useContext(NotificationAutomationContext);
  if (!context) throw new Error('useNotificationAutomation deve ser usado dentro de NotificationAutomationProvider.');
  return context;
}