import assert from 'node:assert/strict';
import test from 'node:test';
import { getCardInvoiceNotifications } from '../services/pendingNotifications.ts';

function card(id, name, invoices) {
  return { id, name, invoices };
}

test('seleciona apenas faturas fechadas e atrasadas para notificações', () => {
  const notifications = getCardInvoiceNotifications([
    card('card-1', 'Cartão principal', [
      { invoiceMonth: '2026-09', amount: 100, status: 'open' },
      { invoiceMonth: '2026-08', amount: 200, status: 'paid' },
      { invoiceMonth: '2026-07', amount: 300, status: 'overdue' },
      { invoiceMonth: '2026-06', amount: 400, status: 'closed' },
    ]),
  ]);

  assert.deepEqual(
    notifications.map(({ invoice }) => ({
      invoiceMonth: invoice.invoiceMonth,
      status: invoice.status,
    })),
    [
      { invoiceMonth: '2026-06', status: 'closed' },
      { invoiceMonth: '2026-07', status: 'overdue' },
    ],
  );
});

test('mantém faturas fechadas e atrasadas como notificações distintas', () => {
  const notifications = getCardInvoiceNotifications([
    card('card-1', 'Cartão principal', [
      { invoiceMonth: '2026-09', amount: 100, status: 'overdue' },
      { invoiceMonth: '2026-09', amount: 200, status: 'closed' },
    ]),
  ]);

  const closedNotifications = notifications.filter(({ invoice }) => invoice.status === 'closed');
  const overdueNotifications = notifications.filter(({ invoice }) => invoice.status === 'overdue');

  assert.equal(closedNotifications.length, 1);
  assert.equal(overdueNotifications.length, 1);
  assert.equal(closedNotifications[0].invoice.amount, 200);
  assert.equal(overdueNotifications[0].invoice.amount, 100);
});