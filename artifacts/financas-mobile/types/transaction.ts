export type TransactionType = 'income' | 'expense';

export type RecurrenceKind = 'none' | 'recurring';
export type RecurrenceUnit = 'day' | 'week' | 'month' | 'year';

export type PaymentStatus = 'paid' | 'unpaid';

export interface Recurrence {
  kind: RecurrenceKind;
  interval?: number;
  unit?: RecurrenceUnit;
  frequency?: 'monthly' | 'weekly' | 'yearly';
  startDate?: string;
  endDate?: string;
  occurrences?: number;
}

export interface Transaction {
  id: string;
  walletId: string;
  type: TransactionType;
  amount: number;
  description: string;
  date: string;
  dueDate?: string | null;
  recurrence: Recurrence;
  paymentStatus: PaymentStatus;
  paymentStatusOverrides?: Record<string, PaymentStatus>;
  createdAt: string;
}

export interface NewTransactionInput {
  walletId?: string;
  type: TransactionType;
  amount: number;
  description: string;
  date?: string;
  dueDate?: string | null;
  recurrence: Recurrence;
  paymentStatus: PaymentStatus;
}

export interface TransactionOccurrence extends Transaction {
  sourceId: string;
  occurrenceKey: string;
  isVirtual: boolean;
}