export type TransactionType = 'income' | 'expense' | 'transfer';

export type RecurrenceKind = 'none' | 'recurring' | 'installment';
export type RecurrenceUnit = 'day' | 'week' | 'month' | 'year';
export type RecurrencePeriod = 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'annual';
export type InstallmentAmountMode = 'installment' | 'total';

export type PaymentStatus = 'paid' | 'unpaid';

export const RECURRENCE_PERIODS: Array<{
  value: RecurrencePeriod;
  label: string;
  unit: RecurrenceUnit;
  multiplier: number;
}> = [
  { value: 'weekly', label: 'Semanal', unit: 'week', multiplier: 1 },
  { value: 'biweekly', label: 'Quinzenal', unit: 'week', multiplier: 2 },
  { value: 'monthly', label: 'Mensal', unit: 'month', multiplier: 1 },
  { value: 'bimonthly', label: 'Bimestral', unit: 'month', multiplier: 2 },
  { value: 'quarterly', label: 'Trimestral', unit: 'month', multiplier: 3 },
  { value: 'semiannual', label: 'Semestral', unit: 'month', multiplier: 6 },
  { value: 'annual', label: 'Anual', unit: 'year', multiplier: 1 },
];

export interface Recurrence {
  kind: RecurrenceKind;
  interval?: number;
  unit?: RecurrenceUnit;
  period?: RecurrencePeriod;
  frequency?: 'monthly' | 'weekly' | 'yearly';
  startDate?: string;
  endDate?: string;
  occurrences?: number;
  amountMode?: InstallmentAmountMode;
}

export interface Transaction {
  id: string;
  walletId: string;
  destinationWalletId?: string | null;
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
  destinationWalletId?: string | null;
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