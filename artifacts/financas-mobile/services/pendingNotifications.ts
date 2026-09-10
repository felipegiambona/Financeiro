import { getTransactionOccurrencesInRange } from '@/services/recurrence';
import { Transaction, TransactionOccurrence } from '@/types/transaction';
import { formatDate, getDayKey, parseStoredDate } from '@/utils/date';

function getTodayEnd(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
}

function getTransactionRangeStart(transactions: Transaction[], fallback: Date): Date {
  const firstDate = transactions.reduce<Date | null>((current, transaction) => {
    const transactionDate = parseStoredDate(transaction.dueDate ?? transaction.date);
    if (!current || transactionDate.getTime() < current.getTime()) return transactionDate;
    return current;
  }, null);

  if (!firstDate) return fallback;
  return new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate(), 0, 0, 0, 0);
}

export function getPendingTransactionOccurrences(
  transactions: Transaction[],
  now = new Date(),
): TransactionOccurrence[] {
  if (transactions.length === 0) return [];

  const todayEnd = getTodayEnd(now);
  const occurrences = getTransactionOccurrencesInRange(
    transactions,
    getTransactionRangeStart(transactions, todayEnd),
    todayEnd,
  );

  return occurrences
    .filter((transaction) => transaction.paymentStatus === 'unpaid')
    .sort((a, b) => parseStoredDate(a.date).getTime() - parseStoredDate(b.date).getTime());
}

export function formatPendingTransactionDate(dateString: string, now = new Date()): string {
  const date = parseStoredDate(dateString);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);

  if (getDayKey(date) === getDayKey(today)) return 'Vence hoje';
  return `Vencido em ${formatDate(dateString)}`;
}