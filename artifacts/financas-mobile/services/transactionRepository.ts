import AsyncStorage from '@react-native-async-storage/async-storage';
import { TRANSACTIONS_STORAGE_KEY } from '@/constants/storage';
import {
  NewTransactionInput,
  Transaction,
} from '@/types/transaction';
import { createLocalIsoDate, getDateKey } from '@/utils/date';

function sortByDate(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

export async function getTransactions(): Promise<Transaction[]> {
  const stored = await AsyncStorage.getItem(TRANSACTIONS_STORAGE_KEY);
  if (!stored) return [];

  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed)) {
    throw new Error('Os lançamentos armazenados estão inválidos.');
  }

  return sortByDate(parsed as Transaction[]);
}

export async function getTransactionsByMonth(
  month: Date,
): Promise<Transaction[]> {
  const transactions = await getTransactions();
  const monthKey = getDateKey(month);
  return transactions.filter((transaction) => getDateKey(new Date(transaction.date)) === monthKey);
}

export async function createTransaction(
  input: NewTransactionInput,
): Promise<Transaction> {
  const transactions = await getTransactions();
  const now = new Date();
  const transaction: Transaction = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    type: input.type,
    amount: input.amount,
    description: input.description.trim(),
    date: input.date ?? createLocalIsoDate(now),
    recurrence: { kind: input.recurrence },
    createdAt: now.toISOString(),
  };

  await AsyncStorage.setItem(
    TRANSACTIONS_STORAGE_KEY,
    JSON.stringify(sortByDate([transaction, ...transactions])),
  );
  return transaction;
}

export async function updateTransaction(
  id: string,
  updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>,
): Promise<Transaction> {
  const transactions = await getTransactions();
  const current = transactions.find((transaction) => transaction.id === id);
  if (!current) throw new Error('Lançamento não encontrado.');

  const updated = { ...current, ...updates };
  await AsyncStorage.setItem(
    TRANSACTIONS_STORAGE_KEY,
    JSON.stringify(sortByDate(transactions.map((item) => item.id === id ? updated : item))),
  );
  return updated;
}

export async function deleteTransaction(id: string): Promise<void> {
  const transactions = await getTransactions();
  await AsyncStorage.setItem(
    TRANSACTIONS_STORAGE_KEY,
    JSON.stringify(transactions.filter((transaction) => transaction.id !== id)),
  );
}