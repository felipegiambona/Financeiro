import {
  Recurrence,
  RecurrenceUnit,
  Transaction,
  TransactionOccurrence,
} from '@/types/transaction';
import { createLocalIsoDate } from '@/utils/date';

const LEGACY_FREQUENCY_UNITS: Record<string, RecurrenceUnit> = {
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
};

export function normalizeRecurrence(recurrence?: Partial<Recurrence>): Recurrence {
  if (recurrence?.kind !== 'recurring') return { kind: 'none' };

  const legacyUnit = recurrence.frequency ? LEGACY_FREQUENCY_UNITS[recurrence.frequency] : undefined;
  const unit = recurrence.unit ?? legacyUnit ?? 'month';
  const rawInterval = Number(recurrence.interval);
  const interval = Number.isInteger(rawInterval) && rawInterval > 0 ? rawInterval : 1;

  return { kind: 'recurring', interval, unit };
}

function addMonthsClamped(start: Date, months: number): Date {
  const targetYear = start.getFullYear() + Math.floor((start.getMonth() + months) / 12);
  const targetMonth = (start.getMonth() + months) % 12;
  const normalizedMonth = targetMonth < 0 ? targetMonth + 12 : targetMonth;
  const normalizedYear = targetMonth < 0 ? targetYear - 1 : targetYear;
  const lastDay = new Date(normalizedYear, normalizedMonth + 1, 0, 12).getDate();
  return new Date(normalizedYear, normalizedMonth, Math.min(start.getDate(), lastDay), 12);
}

export function getRecurrenceDate(
  start: Date,
  interval: number,
  unit: RecurrenceUnit,
  occurrenceIndex: number,
): Date {
  const step = interval * occurrenceIndex;

  if (unit === 'month') return addMonthsClamped(start, step);
  if (unit === 'year') return addMonthsClamped(start, step * 12);

  const days = unit === 'week' ? step * 7 : step;
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + days, 12);
}

export function getTransactionOccurrencesInRange(
  transactions: Transaction[],
  rangeStart: Date,
  rangeEnd: Date,
): TransactionOccurrence[] {
  const startTime = rangeStart.getTime();
  const endTime = rangeEnd.getTime();
  const occurrences: TransactionOccurrence[] = [];

  for (const transaction of transactions) {
    const recurrence = normalizeRecurrence(transaction.recurrence);
    const seriesStart = new Date(transaction.dueDate ?? transaction.date);

    if (recurrence.kind === 'none') {
      const transactionTime = seriesStart.getTime();
      if (transactionTime >= startTime && transactionTime <= endTime) {
        occurrences.push({
          ...transaction,
          date: transaction.dueDate ?? transaction.date,
          dueDate: transaction.dueDate ?? transaction.date,
          recurrence,
          sourceId: transaction.id,
          occurrenceKey: `${transaction.id}:${transaction.dueDate ?? transaction.date}`,
          isVirtual: false,
        });
      }
      continue;
    }

    const interval = recurrence.interval ?? 1;
    const unit = recurrence.unit ?? 'month';

    for (let occurrenceIndex = 0; occurrenceIndex < 100000; occurrenceIndex += 1) {
      const occurrenceDate = getRecurrenceDate(seriesStart, interval, unit, occurrenceIndex);
      const occurrenceTime = occurrenceDate.getTime();
      if (occurrenceTime > endTime) break;
      if (occurrenceTime < startTime) continue;

      const date = createLocalIsoDate(occurrenceDate);
      occurrences.push({
        ...transaction,
        date,
        dueDate: date,
        paymentStatus: transaction.paymentStatusOverrides?.[date] ?? transaction.paymentStatus,
        recurrence,
        sourceId: transaction.id,
        occurrenceKey: `${transaction.id}:${date}`,
        isVirtual: occurrenceIndex > 0,
      });
    }
  }

  return occurrences.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getTransactionOccurrencesForMonth(
  transactions: Transaction[],
  month: Date,
): TransactionOccurrence[] {
  const rangeStart = new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0, 0);
  const rangeEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);
  return getTransactionOccurrencesInRange(transactions, rangeStart, rangeEnd);
}