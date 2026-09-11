import {
  clearTransactions as clearTransactionsRequest,
  createTransaction as createTransactionRequest,
  deleteTransaction as deleteTransactionRequest,
  deleteTransactions as deleteTransactionsRequest,
  listTransactions,
  updateTransactions as updateTransactionsRequest,
  updateTransaction as updateTransactionRequest,
  updateTransactionOccurrencePaymentStatus as updateOccurrenceRequest,
} from '@workspace/api-client-react';
import type { NewTransactionInput, PaymentStatus, Transaction } from '@/types/transaction';
import { createLocalIsoDate, getDateKey, getDayKey, parseStoredDate } from '@/utils/date';
import { getTransactionOccurrencesForMonth, normalizeRecurrence } from '@/services/recurrence';

function normalizeTransaction(value: Transaction): Transaction {
  return {
    ...value,
    recurrence: normalizeRecurrence(value.recurrence),
    paymentStatusOverrides: value.paymentStatusOverrides ?? {},
  };
}

export async function getTransactions(): Promise<Transaction[]> {
  const transactions = await listTransactions();
  return transactions.map(normalizeTransaction) as Transaction[];
}

export async function getTransactionsByMonth(month: Date): Promise<Transaction[]> {
  const transactions = await getTransactions();
  const monthKey = getDateKey(month);
  return getTransactionOccurrencesForMonth(transactions, month)
    .filter((transaction) => getDateKey(parseStoredDate(transaction.date)) === monthKey);
}

export async function createTransaction(input: NewTransactionInput): Promise<Transaction> {
  const transaction = await createTransactionRequest({
    ...input,
    description: input.description.trim(),
    date: input.date ?? createLocalIsoDate(),
  });
  return normalizeTransaction(transaction as Transaction);
}

export async function updateTransaction(
  id: string,
  updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>,
): Promise<Transaction> {
  const transaction = await updateTransactionRequest(id, updates);
  return normalizeTransaction(transaction as Transaction);
}

export async function updateTransactionOccurrencePaymentStatus(
  id: string,
  occurrenceDate: string,
  paymentStatus: PaymentStatus,
): Promise<Transaction> {
  const normalizedOccurrenceDate = /^\d{4}-\d{2}-\d{2}$/.test(occurrenceDate)
    ? occurrenceDate
    : getDayKey(parseStoredDate(occurrenceDate));
  const transaction = await updateOccurrenceRequest(id, normalizedOccurrenceDate, { paymentStatus });
  return normalizeTransaction(transaction as Transaction);
}

export async function deleteTransaction(id: string): Promise<void> {
  await deleteTransactionRequest(id);
}

export async function deleteTransactions(ids: string[]): Promise<void> {
  await deleteTransactionsRequest({ ids });
}

export interface BatchTransactionUpdate {
  walletId?: string;
  categoryId?: string | null;
  dueDate?: string | null;
  paymentStatus?: PaymentStatus;
}

export async function updateTransactions(ids: string[], updates: BatchTransactionUpdate): Promise<void> {
  await updateTransactionsRequest({ ids, ...updates });
}

export async function clearTransactions(): Promise<void> {
  await clearTransactionsRequest();
}