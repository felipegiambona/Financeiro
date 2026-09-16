import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNotificationTransaction } from '../services/notificationTransactionParser.ts';

function event(text, overrides = {}) {
  return {
    eventId: 'bank|notification|1',
    packageName: 'com.example.bank',
    title: 'Banco',
    text,
    postedAt: '2026-09-16T14:30:00.000Z',
    ...overrides,
  };
}

test('reconhece Pix recebido como receita', () => {
  assert.deepEqual(
    parseNotificationTransaction(event('Pix recebido de Felipe no valor de R$ 1.234,56')),
    {
      sourceId: 'bank|notification|1',
      type: 'income',
      amount: 1234.56,
      date: '2026-09-16',
      description: 'Automático · Pix recebido',
    },
  );
});

test('reconhece Pix enviado como despesa', () => {
  const result = parseNotificationTransaction(event('Pix enviado no valor de R$ 50,00'));
  assert.equal(result?.type, 'expense');
  assert.equal(result?.amount, 50);
  assert.equal(result?.description, 'Automático · Pix enviado');
});

test('reconhece compra no cartão e pagamento de conta', () => {
  const purchase = parseNotificationTransaction(event('Compra no cartão aprovada no valor de R$ 42,90'));
  const payment = parseNotificationTransaction(event('Pagamento de conta realizado: R$ 89,99', { eventId: 'bank|notification|2' }));
  assert.equal(purchase?.description, 'Automático · Compra no cartão');
  assert.equal(payment?.description, 'Automático · Pagamento de conta');
  assert.equal(payment?.amount, 89.99);
});

test('reconhece saque em dinheiro como despesa', () => {
  const result = parseNotificationTransaction(event('Saque em dinheiro realizado no valor de R$ 200,00'));
  assert.equal(result?.type, 'expense');
  assert.equal(result?.description, 'Automático · Saque em dinheiro');
  assert.equal(result?.amount, 200);
});

test('reconhece depósitos e recebimentos como receitas', () => {
  const deposit = parseNotificationTransaction(event('Depósito recebido no valor de R$ 300,00'));
  const receipt = parseNotificationTransaction(event('Recebimento confirmado: R$ 75,00', { eventId: 'bank|notification|5' }));
  assert.equal(deposit?.description, 'Automático · Depósito');
  assert.equal(receipt?.description, 'Automático · Recebimento');
  assert.equal(receipt?.type, 'income');
});

test('mantém o dia de São Paulo para notificações próximas da meia-noite UTC', () => {
  const result = parseNotificationTransaction(event('Pix recebido de R$ 10,00', {
    eventId: 'bank|notification|3',
    postedAt: '2026-09-17T02:30:00.000Z',
  }));
  assert.equal(result?.date, '2026-09-16');
});

test('ignora notificação sem movimento financeiro claro', () => {
  assert.equal(parseNotificationTransaction(event('Seu saldo atual é R$ 500,00')), null);
  assert.equal(parseNotificationTransaction(event('Você recebeu uma mensagem nova')), null);
});

test('ignora evento sem identificador ou valor', () => {
  assert.equal(parseNotificationTransaction(event('Pix recebido de alguém', { eventId: '' })), null);
  assert.equal(parseNotificationTransaction(event('Pix recebido de alguém', { eventId: 'bank|notification|4' })), null);
});