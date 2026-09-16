import { getSaoPauloDateKey } from '@/utils/date';
import type { TransactionType } from '@/types/transaction';
import type { AndroidNotificationEvent } from '@/services/notificationListener';

export interface ParsedNotificationTransaction {
  sourceId: string;
  type: Extract<TransactionType, 'income' | 'expense'>;
  amount: number;
  date: string;
  description: string;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function parseBrazilianAmount(value: string): number | null {
  const match = /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2})/i.exec(value);
  if (!match) return null;
  const normalized = match[1].includes(',')
    ? match[1].replace(/\./g, '').replace(',', '.')
    : match[1];
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function transactionKind(text: string): 'income' | 'expense' | null {
  const received = /\b(pix\s+recebid[oa]|recebiment[oa]|recebeu|creditad[oa]|entrada|deposit[oa])\b/.test(text);
  const spent = /\b(pix\s+enviad[oa]|enviou|pagament[oa]|compras?|debitad[oa]|said[ai]|transferenci[ae])\b/.test(text);
  if (received === spent) return null;
  return received ? 'income' : 'expense';
}

function descriptionFor(text: string, type: 'income' | 'expense'): string {
  if (text.includes('pix')) return type === 'income' ? 'Automático · Pix recebido' : 'Automático · Pix enviado';
  if (text.includes('compra')) return 'Automático · Compra';
  if (text.includes('pagamento')) return 'Automático · Pagamento';
  return type === 'income' ? 'Automático · Receita' : 'Automático · Despesa';
}

export function parseNotificationTransaction(
  event: AndroidNotificationEvent,
): ParsedNotificationTransaction | null {
  if (!event.eventId || !event.packageName) return null;
  const text = normalizeText([event.title, event.text].filter(Boolean).join(' '));
  if (!text) return null;
  const type = transactionKind(text);
  const amount = parseBrazilianAmount(text);
  const postedAt = new Date(event.postedAt);
  if (!type || amount == null || Number.isNaN(postedAt.getTime())) return null;

  return {
    sourceId: event.eventId,
    type,
    amount,
    date: getSaoPauloDateKey(postedAt),
    description: descriptionFor(text, type),
  };
}