import assert from 'node:assert/strict';
import test from 'node:test';
import { getFilteredCardInvoices } from '../services/cardInvoiceFilters.ts';

function card(id, invoices) {
  return {
    id,
    name: id,
    dueDay: 10,
    closingDay: 3,
    currentInvoiceAmount: 100,
    availableLimit: null,
    invoiceStatus: 'open',
    invoices,
    overdueInvoices: invoices.filter((invoice) => invoice.status === 'overdue'),
    createdAt: '2026-01-01T12:00:00.000Z',
    updatedAt: '2026-01-01T12:00:00.000Z',
  };
}

const invoices = [
  { invoiceMonth: '2026-09', amount: 100, status: 'paid', dueDate: '2026-09-10', closingDate: '2026-09-03' },
  { invoiceMonth: '2026-09', amount: 200, status: 'open', dueDate: '2026-09-11', closingDate: '2026-09-03' },
  { invoiceMonth: '2026-09', amount: 300, status: 'closed', dueDate: '2026-09-12', closingDate: '2026-09-03' },
  { invoiceMonth: '2026-09', amount: 400, status: 'overdue', dueDate: '2026-09-13', closingDate: '2026-09-03' },
  { invoiceMonth: '2026-08', amount: 500, status: 'open', dueDate: '2026-08-10', closingDate: '2026-08-03' },
];

test('combina cartão, não pago e vencimento inclusivo', () => {
  const results = getFilteredCardInvoices(
    [card('principal', invoices), card('secundario', invoices)],
    {
      monthKey: '2026-09',
      cardId: 'principal',
      status: 'unpaid',
      dateRangeStart: new Date(2026, 8, 11, 12),
      dateRangeEnd: new Date(2026, 8, 13, 12),
    },
  );

  assert.deepEqual(
    results.map(({ card: selectedCard, invoice }) => [selectedCard.id, invoice.status, invoice.dueDate]),
    [
      ['principal', 'open', '2026-09-11'],
      ['principal', 'closed', '2026-09-12'],
      ['principal', 'overdue', '2026-09-13'],
    ],
  );
});

test('pago inclui apenas faturas pagas e não pago inclui todos os demais estados', () => {
  const cards = [card('principal', invoices)];
  const options = {
    monthKey: '2026-09',
    cardId: 'all',
    dateRangeStart: null,
    dateRangeEnd: null,
  };

  assert.deepEqual(
    getFilteredCardInvoices(cards, { ...options, status: 'paid' }).map(({ invoice }) => invoice.status),
    ['paid'],
  );
  assert.deepEqual(
    getFilteredCardInvoices(cards, { ...options, status: 'unpaid' }).map(({ invoice }) => invoice.status),
    ['open', 'closed', 'overdue'],
  );
});

test('sem intervalo usa o mês selecionado, e o cartão limita a seleção', () => {
  const results = getFilteredCardInvoices([card('principal', invoices), card('secundario', invoices)], {
    monthKey: '2026-08',
    cardId: 'secundario',
    status: 'all',
    dateRangeStart: null,
    dateRangeEnd: null,
  });

  assert.deepEqual(
    results.map(({ card: selectedCard, invoice }) => [selectedCard.id, invoice.invoiceMonth]),
    [['secundario', '2026-08']],
  );
});