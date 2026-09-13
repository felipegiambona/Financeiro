import {
  createCard as createCardRequest,
  deleteCard as deleteCardRequest,
  getCard as getCardRequest,
  getCardHistory as getCardHistoryRequest,
  listCards,
  payCardInvoice as payCardInvoiceRequest,
  updateCard as updateCardRequest,
} from '@workspace/api-client-react';
import type { Card, CardHistoryItem, CardUpdate, NewCardInput } from '@/types/card';

export async function getCards(): Promise<Card[]> {
  return listCards() as Promise<Card[]>;
}

export async function getCard(id: string): Promise<Card> {
  return getCardRequest(id) as Promise<Card>;
}

export async function getCardHistory(id: string): Promise<CardHistoryItem[]> {
  return getCardHistoryRequest(id) as Promise<CardHistoryItem[]>;
}

export async function createCard(input: NewCardInput): Promise<Card> {
  return createCardRequest({
    ...input,
    name: input.name.trim(),
  }) as Promise<Card>;
}

export async function updateCard(id: string, updates: CardUpdate): Promise<Card> {
  return updateCardRequest(id, {
    ...updates,
    ...(updates.name === undefined ? {} : { name: updates.name.trim() }),
  }) as Promise<Card>;
}

export async function deleteCard(id: string): Promise<void> {
  await deleteCardRequest(id);
}

export async function payCardInvoice(id: string): Promise<Card> {
  return payCardInvoiceRequest(id) as Promise<Card>;
}