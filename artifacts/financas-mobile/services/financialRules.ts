import { Transaction } from '@/types/transaction';
import { getDateKey, isFutureDate } from '@/utils/date';

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
  return new Date(transaction.date).getTime() <= endDate.getTime();
}

function calculateBalanceAtDate(
  transactions: Transaction[],
  endDate: Date,
): number {
  return transactions.reduce((total, transaction) => {
    if (!isOnOrBefore(transaction, endDate) || transaction.paymentStatus === 'unpaid') return total;
    return total + transactionValue(transaction);
  }, 0);
}

export function calculateCurrentBalance(
  transactions: Transaction[],
  now = new Date(),
): number {
  return transactions.reduce((total, transaction) => {
    if (isFutureDate(transaction.date, now) || transaction.paymentStatus === 'unpaid') return total;
    return total + (transaction.type === 'income' ? transaction.amount : -transaction.amount);
  }, 0);
}

export function calculateMonthlyTotals(
  transactions: Transaction[],
  month: Date,
): MonthlyTotals {
  const monthKey = getDateKey(month);
  return transactions.reduce(
    (totals, transaction) => {
      if (getDateKey(new Date(transaction.date)) !== monthKey) return totals;
      if (transaction.type === 'income') totals.income += transaction.amount;
      else totals.expense += transaction.amount;
      return totals;
    },
    { income: 0, expense: 0 },
  );
}

export function calculateForecast(
  transactions: Transaction[],
  now = new Date(),
): number {
  return transactions.reduce((total, transaction) => {
    if (!isFutureDate(transaction.date, now) && transaction.paymentStatus !== 'unpaid') return total;
    return total + (transaction.type === 'income' ? transaction.amount : -transaction.amount);
  }, calculateCurrentBalance(transactions, now));
}

export function calculateForecastByMonth(
  transactions: Transaction[],
  year: number,
  now = new Date(),
): MonthlyForecast[] {
  const currentBalance = calculateCurrentBalance(transactions, now);

  return Array.from({ length: 12 }, (_, monthIndex) => {
    const date = new Date(year, monthIndex, 1, 12);
    const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59);

    if (monthEnd.getTime() < now.getTime()) {
      return {
        key: getDateKey(date),
        date,
        forecast: calculateBalanceAtDate(transactions, monthEnd),
      };
    }

    const forecast = transactions.reduce((total, transaction) => {
      const isProjected = isFutureDate(transaction.date, now) || transaction.paymentStatus === 'unpaid';
      if (!isProjected || !isOnOrBefore(transaction, monthEnd)) return total;
      return total + transactionValue(transaction);
    }, currentBalance);

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