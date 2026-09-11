import {
  Recurrence,
  RECURRENCE_PERIODS,
  RecurrenceUnit,
  Transaction,
  TransactionOccurrence,
} from '@/types/transaction';
import { createLocalIsoDate, getDayKey, parseStoredDate } from '@/utils/date';

const LEGACY_FREQUENCY_UNITS: Record<string, RecurrenceUnit> = {
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
};

export function normalizeRecurrence(recurrence?: Partial<Recurrence>): Recurrence {
  if (recurrence?.kind !== 'recurring' && recurrence?.kind !== 'installment') return { kind: 'none' };

  const legacyUnit = recurrence.frequency ? LEGACY_FREQUENCY_UNITS[recurrence.frequency] : undefined;
  const unit = recurrence.unit ?? legacyUnit ?? 'month';
  const rawInterval = Number(recurrence.interval);
  const interval = Number.isInteger(rawInterval) && rawInterval > 0 ? rawInterval : 1;
  const period = RECURRENCE_PERIODS.some((option) => option.value === recurrence.period)
    ? recurrence.period
    : undefined;
  const endDate = recurrence.endDate
    ? createLocalIsoDate(parseStoredDate(recurrence.endDate))
    : undefined;
  const rawOccurrences = Number(recurrence.occurrences);
  const occurrences = Number.isInteger(rawOccurrences) && rawOccurrences > 0
    ? rawOccurrences
    : recurrence.kind === 'installment' ? 1 : undefined;
  const excludedDates = Array.isArray(recurrence.excludedDates)
    ? Array.from(new Set(
      recurrence.excludedDates
        .filter((date): date is string => typeof date === 'string')
        .map((date) => createLocalIsoDate(parseStoredDate(date))),
    ))
    : undefined;

  return {
    kind: recurrence.kind,
    interval,
    unit,
    period,
    endDate,
    occurrences,
    ...(excludedDates && excludedDates.length > 0 ? { excludedDates } : {}),
    ...(recurrence.kind === 'installment' && recurrence.amountMode ? { amountMode: recurrence.amountMode } : {}),
  };
}

function getRecurrenceCadence(recurrence: Recurrence): { interval: number; unit: RecurrenceUnit } {
  const period = RECURRENCE_PERIODS.find((option) => option.value === recurrence.period);
  if (!period) {
    return { interval: recurrence.interval ?? 1, unit: recurrence.unit ?? 'month' };
  }
  return {
    interval: (recurrence.interval ?? 1) * period.multiplier,
    unit: period.unit,
  };
}

function getInstallmentAmount(
  totalAmount: number,
  installments: number,
  occurrenceIndex: number,
  amountMode?: Recurrence['amountMode'],
): number {
  if (amountMode !== 'total' || installments <= 0) return totalAmount;
  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / installments);
  const remainderCents = totalCents - baseCents * installments;
  return (baseCents + (occurrenceIndex < remainderCents ? 1 : 0)) / 100;
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
    const seriesStart = parseStoredDate(transaction.dueDate ?? transaction.date);

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

    const { interval, unit } = getRecurrenceCadence(recurrence);

    for (let occurrenceIndex = 0; occurrenceIndex < 100000; occurrenceIndex += 1) {
      if (recurrence.occurrences !== undefined && occurrenceIndex >= recurrence.occurrences) break;
      const occurrenceDate = getRecurrenceDate(seriesStart, interval, unit, occurrenceIndex);
      const occurrenceTime = occurrenceDate.getTime();
      if (occurrenceTime > endTime) break;
      if (recurrence.endDate && occurrenceTime > parseStoredDate(recurrence.endDate).getTime()) break;
      if (occurrenceTime < startTime) continue;

      const date = createLocalIsoDate(occurrenceDate);
      const occurrenceDateKey = getDayKey(occurrenceDate);
      if (recurrence.excludedDates?.includes(date)) continue;
      occurrences.push({
        ...transaction,
        amount: recurrence.kind === 'installment'
          ? getInstallmentAmount(
            transaction.amount,
            recurrence.occurrences ?? 1,
            occurrenceIndex,
            recurrence.amountMode,
          )
          : transaction.amount,
        date,
        dueDate: date,
        paymentStatus: transaction.paymentStatusOverrides?.[occurrenceDateKey]
          ?? transaction.paymentStatusOverrides?.[date]
          ?? (occurrenceIndex === 0 ? transaction.paymentStatus : 'unpaid'),
        recurrence,
        sourceId: transaction.id,
        occurrenceKey: `${transaction.id}:${date}`,
        isVirtual: occurrenceIndex > 0,
      });
    }
  }

  return occurrences.sort((a, b) => parseStoredDate(b.date).getTime() - parseStoredDate(a.date).getTime());
}

export function getTransactionOccurrencesForMonth(
  transactions: Transaction[],
  month: Date,
): TransactionOccurrence[] {
  const rangeStart = new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0, 0);
  const rangeEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);
  return getTransactionOccurrencesInRange(transactions, rangeStart, rangeEnd);
}