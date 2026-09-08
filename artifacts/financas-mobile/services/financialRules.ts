import { Transaction } from '@/types/transaction';
import { getDateKey, isFutureDate, parseStoredDate } from '@/utils/date';
import {
  getTransactionOccurrencesForMonth,
  getTransactionOccurrencesInRange,
} from '@/services/recurrence';

export interface MonthlyTotals {
  income: number;
  expense: number;
}

export interface MonthlyForecast {
  key: string;
  date: Date;
  forecast: number;
}

function transactionValue(transaction: Transaction): number {
  return transaction.type === 'income' ? transaction.amount : -transaction.amount;
}

function isOnOrBefore(transaction: Transaction, endDate: Date): boolean {
  return parseStoredDate(transaction.date).getTime() <= endDate.getTime();
}

function getRangeStart(transactions: Transaction[], fallback: Date): Date {
  if (transactions.length === 0) return fallback;
  const earliest = Math.min(...transactions.map((transaction) => parseStoredDate(transaction.date).getTime()));
  return new Date(earliest);
}

function calculateBalanceAtDate(
  transactions: Transaction[],
  endDate: Date,
): number {
  const occurrences = getTransactionOccurrencesInRange(
    transactions,
    getRangeStart(transactions, endDate),
    endDate,
  );
  return occurrences.reduce((total, transaction) => {
    if (!isOnOrBefore(transaction, endDate) || transaction.paymentStatus === 'unpaid') return total;
    return total + transactionValue(transaction);
  }, 0);
}

export function calculateCurrentBalance(
  transactions: Transaction[],
  now = new Date(),
): number {
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const occurrences = getTransactionOccurrencesInRange(
    transactions,
    getRangeStart(transactions, now),
    todayEnd,
  );
  return occurrences.reduce((total, transaction) => {
    if (isFutureDate(transaction.date, now) || transaction.paymentStatus === 'unpaid') return total;
    return total + (transaction.type === 'income' ? transaction.amount : -transaction.amount);
  }, 0);
}

export function calculateMonthlyTotals(
  transactions: Transaction[],
  month: Date,
): MonthlyTotals {
  const occurrences = getTransactionOccurrencesForMonth(transactions, month);
  return occurrences.reduce(
    (totals, transaction) => {
      if (transaction.type === 'income') totals.income += transaction.amount;
      else totals.expense += transaction.amount;
      return totals;
    },
    { income: 0, expense: 0 },
  );
}

export function calculateForecast(
  transactions: Transaction[],
  targetMonth = new Date(),
  now = new Date(),
): number {
  const forecastEnd = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );

  if (forecastEnd.getTime() < now.getTime()) {
    return calculateBalanceAtDate(transactions, forecastEnd);
  }

  const occurrences = getTransactionOccurrencesInRange(
    transactions,
    getRangeStart(transactions, now),
    forecastEnd,
  );
  return occurrences.reduce((total, transaction) => {
    if (!isFutureDate(transaction.date, now) && transaction.paymentStatus !== 'unpaid') return total;
    return total + (transaction.type === 'income' ? transaction.amount : -transaction.amount);
  }, calculateCurrentBalance(transactions, now));
}

export function calculateForecastByMonth(
  transactions: Transaction[],
  year: number,
  _now = new Date(),
): MonthlyForecast[] {
  return Array.from({ length: 12 }, (_, monthIndex) => {
    const date = new Date(year, monthIndex, 1, 12);
    const occurrences = getTransactionOccurrencesForMonth(transactions, date);
    const forecast = occurrences.reduce((total, transaction) => total + transactionValue(transaction), 0);

    return { key: getDateKey(date), date, forecast };
  });
}

export function calculateTotalsByMonth(
  transactions: Transaction[],
  months = 6,
  now = new Date(),
): Array<{ key: string; date: Date; income: number; expense: number }> {
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (months - 1 - index), 1, 12);
    const totals = calculateMonthlyTotals(transactions, date);
    return { key: getDateKey(date), date, ...totals };
  });
}