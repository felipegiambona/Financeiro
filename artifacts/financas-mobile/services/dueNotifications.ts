import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getTransactionOccurrencesInRange } from '@/services/recurrence';
import { Transaction } from '@/types/transaction';

const CHANNEL_ID = 'due-dates';
const MAX_SCHEDULED_DAYS = 60;

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export async function syncDueNotifications(transactions: Transaction[]): Promise<void> {
  if (Platform.OS === 'web') return;

  const currentPermission = await Notifications.getPermissionsAsync();
  const permission = currentPermission.granted
    ? currentPermission
    : await Notifications.requestPermissionsAsync();

  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!permission.granted) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Vencimentos',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const rangeEnd = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const occurrences = getTransactionOccurrencesInRange(transactions, rangeStart, rangeEnd)
    .filter((item) => item.paymentStatus === 'unpaid');

  const itemsByDay = new Map<string, { date: Date; descriptions: string[] }>();
  for (const item of occurrences) {
    const dueDate = new Date(item.dueDate);
    const key = dayKey(dueDate);
    const current = itemsByDay.get(key);
    if (current) current.descriptions.push(item.description);
    else itemsByDay.set(key, { date: dueDate, descriptions: [item.description] });
  }

  const days = [...itemsByDay.values()]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, MAX_SCHEDULED_DAYS);

  for (const day of days) {
    let triggerDate = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate(), 9, 0, 0, 0);
    if (dayKey(triggerDate) === dayKey(now) && triggerDate.getTime() <= now.getTime()) {
      triggerDate = new Date(now.getTime() + 5000);
    }
    if (triggerDate.getTime() <= now.getTime()) continue;

    const count = day.descriptions.length;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: count === 1 ? 'Você tem um item vencendo hoje' : `Você tem ${count} itens vencendo hoje`,
        body: count === 1 ? day.descriptions[0] : day.descriptions.slice(0, 2).join(' • '),
        sound: 'default',
        data: { screen: 'transactions' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
      },
    });
  }
}