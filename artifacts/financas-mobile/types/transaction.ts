export type TransactionType = 'income' | 'expense';

export type RecurrenceKind = 'none' | 'recurring';

export type PaymentStatus = 'paid' | 'unpaid';

export interface Recurrence {
  kind: RecurrenceKind;
  frequency?: 'monthly' | 'weekly' | 'yearly';
  startDate?: string;
  endDate?: string;
  occurrences?: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  date: string;
  recurrence: Recurrence;
  paymentStatus: PaymentStatus;
  createdAt: string;
}

export interface NewTransactionInput {
  type: TransactionType;
  amount: number;
  description: string;
  date?: string;
  recurrence: RecurrenceKind;
  paymentStatus: PaymentStatus;
}