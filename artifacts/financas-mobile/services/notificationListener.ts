import { NativeModules, Platform } from 'react-native';
import type { NewTransactionInput, TransactionType } from '@/types/transaction';

export interface NotificationTransactionCandidate extends NewTransactionInput {
  id: string;
}

interface NotificationListenerNativeModule {
  isNotificationListenerEnabled: () => Promise<boolean>;
  openNotificationListenerSettings: () => Promise<boolean>;
  getPendingNotifications: () => Promise<NotificationTransactionCandidate[]>;
  acknowledgeNotifications: (ids: string[]) => Promise<boolean>;
  clearPendingNotifications: () => Promise<boolean>;
}

function getNativeModule(): NotificationListenerNativeModule | null {
  if (Platform.OS !== 'android') return null;
  return (NativeModules as Record<string, NotificationListenerNativeModule | undefined>)
    .FinancasNotificationListener ?? null;
}

export function isNotificationListenerAvailable(): boolean {
  return getNativeModule() !== null;
}

export async function isNotificationListenerEnabled(): Promise<boolean> {
  return (await getNativeModule()?.isNotificationListenerEnabled()) ?? false;
}

export async function openNotificationListenerSettings(): Promise<boolean> {
  const nativeModule = getNativeModule();
  if (!nativeModule) return false;
  return nativeModule.openNotificationListenerSettings();
}

export async function getPendingNotificationTransactions(): Promise<NotificationTransactionCandidate[]> {
  const nativeModule = getNativeModule();
  if (!nativeModule) return [];
  const candidates = await nativeModule.getPendingNotifications();
  return candidates.filter((candidate) => (
    candidate.id
    && (candidate.type === 'income' || candidate.type === 'expense')
    && Number.isFinite(candidate.amount)
    && candidate.amount > 0
    && candidate.description.trim().length > 0
  ));
}

export async function acknowledgeNotificationTransactions(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await getNativeModule()?.acknowledgeNotifications(ids);
}

export async function clearPendingNotificationTransactions(): Promise<void> {
  await getNativeModule()?.clearPendingNotifications();
}

export function normalizeNotificationType(value: string): TransactionType {
  return value === 'income' ? 'income' : 'expense';
}