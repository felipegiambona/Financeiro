import { NativeModules, Platform } from 'react-native';

export interface AndroidNotificationEvent {
  eventId: string;
  packageName: string;
  title: string;
  text: string;
  postedAt: number;
}

export interface NotificationListenerStatus {
  supported: boolean;
  enabled: boolean;
  listenerAccessGranted: boolean;
  pendingCount: number;
  allowedPackages: string[];
}

interface NativeNotificationListener {
  getStatus: () => Promise<{
    enabled: boolean;
    listenerAccessGranted: boolean;
    pendingCount: number;
    allowedPackages: string[];
  }>;
  setEnabled: (enabled: boolean) => Promise<void>;
  setAllowedPackages: (packages: string[]) => Promise<void>;
  getPendingEvents: () => Promise<AndroidNotificationEvent[]>;
  acknowledgeEvents: (eventIds: string[]) => Promise<void>;
  clearEvents: () => Promise<void>;
  openSettings: () => Promise<void>;
}

const nativeModule = Platform.OS === 'android'
  ? NativeModules.FinanceNotificationListener as NativeNotificationListener | undefined
  : undefined;

export const androidNotificationListenerSupported = Boolean(nativeModule);

export async function getNotificationListenerStatus(): Promise<NotificationListenerStatus> {
  if (!nativeModule) {
    return {
      supported: false,
      enabled: false,
      listenerAccessGranted: false,
      pendingCount: 0,
      allowedPackages: [],
    };
  }
  const status = await nativeModule.getStatus();
  return { ...status, supported: true };
}

export function setNotificationListenerEnabled(enabled: boolean): Promise<void> {
  return nativeModule?.setEnabled(enabled) ?? Promise.resolve();
}

export function setNotificationListenerPackages(packages: string[]): Promise<void> {
  return nativeModule?.setAllowedPackages(packages) ?? Promise.resolve();
}

export function getPendingAndroidNotifications(): Promise<AndroidNotificationEvent[]> {
  return nativeModule?.getPendingEvents() ?? Promise.resolve([]);
}

export function acknowledgeAndroidNotifications(eventIds: string[]): Promise<void> {
  return nativeModule?.acknowledgeEvents(eventIds) ?? Promise.resolve();
}

export function clearPendingAndroidNotifications(): Promise<void> {
  return nativeModule?.clearEvents() ?? Promise.resolve();
}

export function openNotificationListenerSettings(): Promise<void> {
  return nativeModule?.openSettings() ?? Promise.resolve();
}