import { Transaction } from '@/types/transaction';
import { Wallet } from '@/types/wallet';
import { Card } from '@/types/card';
import { getDateKey, getSaoPauloDateParts, getSaoPauloToday, parseStoredDate } from '@/utils/date';
import {
  getTransactionOccurrencesForMonth,
  getTransactionOccurrencesInRange,
} from '@/services/recurrence';

export interface MonthlyTotals {
  income: number;
  expense: number;
  receivable: number;
  payable: number;
}

export interface MonthlyForecast {
  key: string;
  date: Date;
  forecast: number;
}

export interface WalletTotal {
  wallet: Wallet;
  total: number;
}

function transactionValue(transaction: Transaction): number {
  if (transaction.cardId) return 0;
  if (transaction.type === 'income') return transaction.amount;
  if (transaction.type === 'expense') return -transaction.amount;
  return 0;
}

function walletTransactionValue(transaction: Transaction, walletId: string): number {
  if (transaction.type === 'transfer') {
    if (transaction.walletId === walletId) return -transaction.amount;
    if (transaction.destinationWalletId === walletId) return transaction.amount;
    return 0;
  }
  if (transaction.walletId !== walletId) return 0;
  if (transaction.isInvestment) return -transaction.amount;
  if (transaction.type === 'expense' && transaction.cardEntryType === 'invoice_payment') {
    return -transaction.amount;
  }
  if (transaction.type === 'expense' && transaction.cardId) return 0;
  return transactionValue(transaction);
}

function cardInvoiceTotalForMonth(cards: Card[], month: Date): number {
  const key = getDateKey(month).slice(0, 7);
  return cards.reduce(
    (total, card) => total + card.invoices
      .filter((invoice) => invoice.invoiceMonth === key)
      .reduce((invoiceTotal, invoice) => invoiceTotal + invoice.amount, 0),
    0,
  );
}

function cardOverdueTotalForCurrentMonth(
  cards: Card[],
  month: Date,
  now: Date,
  transactions: Transaction[],
  includePaid = true,
): number {
  const targetMonthKey = getDateKey(month).slice(0, 7);
  const currentMonthKey = getDateKey(now).slice(0, 7);
  if (targetMonthKey !== currentMonthKey) return 0;

  const paymentAmountsByCard = new Map<string, number[]>();
  for (const transaction of getTransactionOccurrencesForMonth(transactions, month)) {
    if (
      transaction.type !== 'expense'
      || transaction.cardEntryType !== 'invoice_payment'
      || !transaction.cardId
      || transaction.paymentStatus === 'unpaid'
    ) continue;

    const payments = paymentAmountsByCard.get(transaction.cardId) ?? [];
    payments.push(transaction.amount);
    paymentAmountsByCard.set(transaction.cardId, payments);
  }

  return cards.reduce(
    (total, card) => {
      const availablePayments = [...(paymentAmountsByCard.get(card.id) ?? [])];
      return total + card.invoices
        .filter((invoice) => invoice.invoiceMonth < currentMonthKey)
        .reduce((invoiceTotal, invoice) => {
          if (invoice.status === 'overdue') return invoiceTotal + invoice.amount;
          if (!includePaid || invoice.status !== 'paid') return invoiceTotal;

          const paymentIndex = availablePayments.findIndex((amount) =>
            Math.round(amount * 100) === Math.round(invoice.amount * 100));
          if (paymentIndex === -1) return invoiceTotal;

          availablePayments.splice(paymentIndex, 1);
          return invoiceTotal + invoice.amount;
        }, 0);
    },
    0,
  );
}

function cardInvoicePayableForMonth(cards: Card[], month: Date): number {
  const key = getDateKey(month).slice(0, 7);
  return cards.reduce(
    (total, card) => total + card.invoices
      .filter((invoice) => invoice.invoiceMonth === key && invoice.status !== 'paid')
      .reduce((invoiceTotal, invoice) => invoiceTotal + invoice.amount, 0),
    0,
  );
}

function isOnOrBefore(transaction: Transaction, endDate: Date): boolean {
  return parseStoredDate(transaction.date).getTime() <= endDate.getTime();
}

function getRangeStart(transactions: Transaction[], fallback: Date): Date {
  if (transactions.length === 0) return fallback;
  const earliest = Math.min(...transactions.map((transaction) => parseStoredDate(transaction.date).getTime()));
  return new Date(earliest);
}

function getBalanceRangeEnd(transactions: Transaction[], fallback: Date): Date {
  let latest = fallback.getTime();

  for (const transaction of transactions) {
    const dates = [
      transaction.dueDate ?? transaction.date,
      ...Object.keys(transaction.paymentStatusOverrides ?? {}),
    ];

    for (const date of dates) {
      const time = parseStoredDate(date).getTime();
      if (Number.isFinite(time)) latest = Math.max(latest, time);
    }
  }

  return new Date(latest);
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
  wallets: Wallet[],
  transactions: Transaction[],
  cards: Card[] = [],
  now = new Date(),
): number {
  return calculateWalletTotals(wallets, transactions, now, cards)
    .reduce((total, walletTotal) => total + walletTotal.total, 0);
}

export function calculateWalletTotals(
  wallets: Wallet[],
  transactions: Transaction[],
  now = new Date(),
  cards: Card[] = [],
): WalletTotal[] {
  const todayEnd = getSaoPauloToday(now);
  todayEnd.setHours(23, 59, 59, 999);
  const balanceRangeEnd = getBalanceRangeEnd(transactions, todayEnd);

  return wallets.map((wallet) => {
    const walletTransactions = transactions.filter((transaction) =>
      transaction.walletId === wallet.id || transaction.destinationWalletId === wallet.id);
    const earliest = walletTransactions.length > 0
      ? Math.min(...walletTransactions.map((transaction) => parseStoredDate(transaction.dueDate ?? transaction.date).getTime()))
      : todayEnd.getTime();
    const occurrences = getTransactionOccurrencesInRange(
      walletTransactions,
      new Date(earliest),
      balanceRangeEnd,
    );
    const total = occurrences.reduce((balance, transaction) => {
      if (transaction.paymentStatus === 'unpaid') return balance;
      return balance + walletTransactionValue(transaction, wallet.id);
    }, wallet.initialBalance);

    return { wallet, total };
  });
}

export function calculateMonthlyTotals(
  transactions: Transaction[],
  month: Date,
  cards: Card[] = [],
  now = new Date(),
): MonthlyTotals {
  const occurrences = getTransactionOccurrencesForMonth(transactions, month);
  const overdueCardInvoices = cardOverdueTotalForCurrentMonth(cards, month, now, transactions);
  const overdueCardInvoicesPayable = cardOverdueTotalForCurrentMonth(cards, month, now, transactions, false);
  return occurrences.reduce(
    (totals, transaction) => {
      if (transaction.cardId) return totals;
      if (transaction.type === 'income') {
        totals.income += transaction.amount;
        if (transaction.paymentStatus === 'unpaid') totals.receivable += transaction.amount;
      } else if (transaction.type === 'expense') {
        totals.expense += transaction.amount;
        if (transaction.paymentStatus === 'unpaid') totals.payable += transaction.amount;
      }
      return totals;
    },
    {
      income: 0,
      expense: cardInvoiceTotalForMonth(cards, month) + overdueCardInvoices,
      receivable: 0,
      payable: cardInvoicePayableForMonth(cards, month) + overdueCardInvoicesPayable,
    },
  );
}

export function calculateForecast(
  transactions: Transaction[],
  targetMonth = new Date(),
  cards: Card[] = [],
  now = new Date(),
): number {
  const occurrences = getTransactionOccurrencesForMonth(transactions, targetMonth);
  return occurrences.reduce((total, transaction) => total + transactionValue(transaction), 0)
    - cardInvoiceTotalForMonth(cards, targetMonth)
    - cardOverdueTotalForCurrentMonth(cards, targetMonth, now, transactions);
}

export function calculateForecastByMonth(
  transactions: Transaction[],
  year: number,
  cards: Card[] = [],
  now = new Date(),
): MonthlyForecast[] {
  return Array.from({ length: 12 }, (_, monthIndex) => {
    const date = new Date(year, monthIndex, 1, 12);
    const occurrences = getTransactionOccurrencesForMonth(transactions, date);
    const forecast = occurrences.reduce((total, transaction) => total + transactionValue(transaction), 0)
        - cardInvoiceTotalForMonth(cards, date)
        - cardOverdueTotalForCurrentMonth(cards, date, now, transactions);

    return { key: getDateKey(date), date, forecast };
  });
}

export function calculateTotalsByMonth(
  transactions: Transaction[],
  months = 6,
  cards: Card[] = [],
  now = new Date(),
): Array<{ key: string; date: Date; income: number; expense: number }> {
  const { year, month } = getSaoPauloDateParts(now);
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(year, month - 1 - (months - 1 - index), 1, 12);
    const totals = calculateMonthlyTotals(transactions, date, cards, now);
    return { key: getDateKey(date), date, ...totals };
  });
}