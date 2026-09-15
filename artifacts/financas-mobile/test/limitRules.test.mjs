import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateLimitUsage } from '../services/limitRules.ts';

const limit = {
  id: 'limit-1',
  categoryId: 'category-food',
  amount: 1000,
  period: 'monthly',
  description: null,
};

test('conta compra no cartão ainda não paga no limite do período', () => {
  const usage = calculateLimitUsage(limit, [
    {
      type: 'expense',
      amount: 250,
      date: '2026-09-05',
      cardId: 'card-1',
      cardEntryType: 'purchase',
      categoryId: 'category-food',
      paymentStatus: 'unpaid',
      isInvestment: false,
      description: 'Mercado',
      recurrence: { kind: 'none' },
    },
  ], new Date('2026-09-15T12:00:00'));

  assert.equal(usage.used, 250);
  assert.equal(usage.remaining, 750);
});

test('não conta pagamento de fatura novamente no limite', () => {
  const usage = calculateLimitUsage(limit, [
    {
      type: 'expense',
      amount: 250,
      date: '2026-09-05',
      cardId: 'card-1',
      cardEntryType: 'purchase',
      categoryId: 'category-food',
      paymentStatus: 'unpaid',
      isInvestment: false,
      description: 'Mercado',
      recurrence: { kind: 'none' },
    },
    {
      type: 'expense',
      amount: 250,
      date: '2026-09-10',
      cardId: 'card-1',
      cardEntryType: 'invoice_payment',
      categoryId: 'category-food',
      paymentStatus: 'paid',
      isInvestment: false,
      description: 'Pagamento de fatura',
      recurrence: { kind: 'none' },
    },
  ], new Date('2026-09-15T12:00:00'));

  assert.equal(usage.used, 250);
});