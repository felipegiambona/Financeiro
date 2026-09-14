import type { Limit, LimitPeriod } from '@/types/limit';
import type { Transaction } from '@/types/transaction';
import { getTransactionOccurrencesInRange } from '@/services/recurrence';
import { parseStoredDate } from '@/utils/date';

export interface LimitDateRange {
  start: Date;
  end: Date;
}

export interface LimitUsage {
  used: number;
  remaining: number;
  percentage: number;
  progress: number;
  range: LimitDateRange;
}

function atNoon(year: number, month: number, day: number): Date {
  return new Date(year, month, day, 12);
}

function addDays(date: Date, days: number): Date {
  return atNoon(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function getLimitDateRange(period: LimitPeriod, now = new Date()): LimitDateRange {
  const year = now.getFullYear();
  const month = now.getMonth();
  if (period === 'weekly') {
    const mondayOffset = (now.getDay() + 6) % 7;
    const start = addDays(atNoon(year, month, now.getDate()), -mondayOffset);
    return { start, end: addDays(start, 6) };
  }
  if (period === 'biweekly') {
    const yearStart = atNoon(year, 0, 1);
    const dayIndex = Math.floor((atNoon(year, month, now.getDate()).getTime() - yearStart.getTime()) / 86_400_000);
    const start = addDays(yearStart, Math.floor(dayIndex / 14) * 14);
    return { start, end: addDays(start, 13) };
  }
  if (period === 'monthly') {
    return { start: atNoon(year, month, 1), end: atNoon(year, month + 1, 0) };
  }
  if (period === 'bimonthly') {
    const startMonth = Math.floor(month / 2) * 2;
    return { start: atNoon(year, startMonth, 1), end: atNoon(year, startMonth + 2, 0) };
  }
  if (period === 'quarterly') {
    const startMonth = Math.floor(month / 3) * 3;
    return { start: atNoon(year, startMonth, 1), end: atNoon(year, startMonth + 3, 0) };
  }
  if (period === 'semiannual') {
    const startMonth = Math.floor(month / 6) * 6;
    return { start: atNoon(year, startMonth, 1), end: atNoon(year, startMonth + 6, 0) };
  }
  return { start: atNoon(year, 0, 1), end: atNoon(year + 1, 0, 0) };
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

export function calculateLimitUsage(
  limit: Limit,
  transactions: Transaction[],
  now = new Date(),
): LimitUsage {
  const range = getLimitDateRange(limit.period, now);
  const occurrences = getTransactionOccurrencesInRange(transactions, range.start, range.end);
  const expectedDescription = limit.description ? normalizeName(limit.description) : null;
  const used = occurrences.reduce((total, transaction) => {
    if (
      transaction.isInvestment
      || transaction.cardId
      ||
      transaction.type !== 'expense'
      || transaction.paymentStatus !== 'paid'
      || transaction.categoryId !== limit.categoryId
      || (expectedDescription && normalizeName(transaction.description) !== expectedDescription)
    ) {
      return total;
    }
    return total + transaction.amount;
  }, 0);
  const percentage = limit.amount > 0 ? (used / limit.amount) * 100 : 0;
  return {
    used,
    remaining: limit.amount - used,
    percentage,
    progress: Math.min(1, Math.max(0, used / limit.amount)),
    range,
  };
}