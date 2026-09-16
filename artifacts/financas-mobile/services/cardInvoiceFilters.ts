import type { Card } from '@/types/card';
import { getSaoPauloDateKey, parseStoredDate } from '@/utils/date';

export type CardInvoiceStatusFilter = 'all' | 'paid' | 'unpaid';

export interface CardInvoiceFilterOptions {
  monthKey: string;
  cardId: string | string[];
  status: CardInvoiceStatusFilter;
  dateRangeStart: Date | null;
  dateRangeEnd: Date | null;
}

export interface CardInvoiceListItem {
  card: Card;
  invoice: Card['invoices'][number];
}

function matchesStatus(
  status: Card['invoices'][number]['status'],
  statusFilter: CardInvoiceStatusFilter,
): boolean {
  if (statusFilter === 'all') return true;
  if (statusFilter === 'paid') return status === 'paid';
  return status !== 'paid';
}

function matchesDueDate(
  dueDate: string,
  dateRangeStart: Date | null,
  dateRangeEnd: Date | null,
): boolean {
  const dueDateKey = getSaoPauloDateKey(parseStoredDate(dueDate));
  const startKey = dateRangeStart ? getSaoPauloDateKey(dateRangeStart) : null;
  const endKey = dateRangeEnd ? getSaoPauloDateKey(dateRangeEnd) : null;

  return (!startKey || dueDateKey >= startKey)
    && (!endKey || dueDateKey <= endKey);
}

export function getFilteredCardInvoices(
  cards: Card[],
  {
    monthKey,
    cardId,
    status,
    dateRangeStart,
    dateRangeEnd,
  }: CardInvoiceFilterOptions,
): CardInvoiceListItem[] {
  const hasDateFilter = dateRangeStart !== null || dateRangeEnd !== null;

  return cards.flatMap((card) => card.invoices
    .filter((invoice) => invoice.amount > 0)
    .filter((invoice) => cardId === 'all' || (Array.isArray(cardId) ? cardId.length === 0 || cardId.includes(card.id) : card.id === cardId))
    .filter((invoice) => matchesStatus(invoice.status, status))
    .filter((invoice) => hasDateFilter
      ? matchesDueDate(invoice.dueDate, dateRangeStart, dateRangeEnd)
      : invoice.invoiceMonth === monthKey)
    .map((invoice) => ({ card, invoice })));
}