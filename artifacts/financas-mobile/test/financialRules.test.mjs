import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateForecast,
  calculateMonthlyTotals,
  calculateWalletTotals,
} from '../services/financialRules.ts';

const month = (value) => new Date(`${value}-01T12:00:00`);

function card(invoices) {
  return { invoices };
}

test('inclui faturas vencidas e não pagas na previsão do mês atual', () => {
  const transactions = [
    {
      type: 'income',
      amount: 1000,
      date: '2026-09-05',
      cardId: null,
      recurrence: { kind: 'none' },
    },
  ];
  const cards = [card([
    { invoiceMonth: '2026-08', amount: 300, status: 'overdue' },
    { invoiceMonth: '2026-09', amount: 200, status: 'closed' },
    { invoiceMonth: '2026-07', amount: 400, status: 'paid' },
  ])];

  assert.equal(
    calculateForecast(transactions, month('2026-09'), cards, new Date('2026-09-15T12:00:00')),
    500,
  );
});

test('não duplica a fatura vencida no mês original', () => {
  const cards = [card([
    { invoiceMonth: '2026-08', amount: 300, status: 'overdue' },
  ])];

  assert.equal(
    calculateForecast([], month('2026-08'), cards, new Date('2026-09-15T12:00:00')),
    -300,
  );
});

test('inclui faturas vencidas e não pagas nas despesas e no total a pagar do mês atual', () => {
  const cards = [card([
    { invoiceMonth: '2026-08', amount: 300, status: 'overdue' },
    { invoiceMonth: '2026-07', amount: 400, status: 'paid' },
    { invoiceMonth: '2026-09', amount: 200, status: 'closed' },
  ])];

  const totals = calculateMonthlyTotals(
    [],
    month('2026-09'),
    cards,
    new Date('2026-09-15T12:00:00'),
  );

  assert.equal(totals.expense, 500);
  assert.equal(totals.payable, 500);
});

test('desconta compras do cartão somente quando a fatura é paga', () => {
  const wallet = {
    id: 'wallet-1',
    name: 'Carteira principal',
    initialBalance: 1000,
    isDefault: true,
  };
  const transactions = [
    {
      id: 'purchase-1',
      walletId: 'wallet-1',
      type: 'expense',
      amount: 300,
      cardId: 'card-1',
      cardEntryType: 'purchase',
      isInvestment: false,
      description: 'Compra no cartão',
      date: '2026-09-05',
      recurrence: { kind: 'none' },
      paymentStatus: 'paid',
    },
    {
      id: 'payment-1',
      walletId: 'wallet-1',
      type: 'expense',
      amount: 300,
      cardId: 'card-1',
      cardEntryType: 'invoice_payment',
      isInvestment: false,
      description: 'Pagamento da fatura',
      date: '2026-09-15',
      recurrence: { kind: 'none' },
      paymentStatus: 'paid',
    },
  ];

  const [walletTotal] = calculateWalletTotals(
    [wallet],
    transactions,
    new Date('2026-09-15T12:00:00'),
    [card([{ amount: 450 }])],
  );

  assert.equal(walletTotal.total, 700);
});