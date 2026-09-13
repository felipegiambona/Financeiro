import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createCard as persistCard,
  deleteCard as removeCard,
  getCards,
  payCardInvoice as persistCardInvoice,
  updateCard as updatePersistedCard,
} from '@/services/cardRepository';
import type { Card, CardUpdate, NewCardInput } from '@/types/card';

interface CardContextValue {
  cards: Card[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createCard: (input: NewCardInput) => Promise<Card>;
  updateCard: (id: string, updates: CardUpdate) => Promise<Card>;
  deleteCard: (id: string) => Promise<void>;
  payCardInvoice: (id: string) => Promise<Card>;
}

const CardContext = createContext<CardContextValue | null>(null);

export function CardProvider({ children }: React.PropsWithChildren) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      setCards(await getCards());
    } catch {
      setError('Não foi possível carregar seus cartões.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createCard = useCallback(async (input: NewCardInput) => {
    try {
      setError(null);
      const created = await persistCard(input);
      await refresh();
      return created;
    } catch {
      setError('Não foi possível salvar o cartão.');
      throw new Error('Não foi possível salvar o cartão.');
    }
  }, [refresh]);

  const updateCard = useCallback(async (id: string, updates: CardUpdate) => {
    try {
      setError(null);
      const updated = await updatePersistedCard(id, updates);
      await refresh();
      return updated;
    } catch {
      setError('Não foi possível atualizar o cartão.');
      throw new Error('Não foi possível atualizar o cartão.');
    }
  }, [refresh]);

  const deleteCard = useCallback(async (id: string) => {
    try {
      setError(null);
      await removeCard(id);
      await refresh();
    } catch {
      setError('Não foi possível excluir o cartão.');
      throw new Error('Não foi possível excluir o cartão.');
    }
  }, [refresh]);

  const payCardInvoice = useCallback(async (id: string) => {
    try {
      setError(null);
      const updated = await persistCardInvoice(id);
      setCards((current) => current.map((card) => card.id === id ? updated : card));
      return updated;
    } catch {
      setError('Não foi possível pagar a fatura.');
      throw new Error('Não foi possível pagar a fatura.');
    }
  }, []);

  const value = useMemo(
    () => ({ cards, loading, error, refresh, createCard, updateCard, deleteCard, payCardInvoice }),
    [cards, createCard, deleteCard, error, loading, payCardInvoice, refresh, updateCard],
  );

  return <CardContext.Provider value={value}>{children}</CardContext.Provider>;
}

export function useCards(): CardContextValue {
  const context = useContext(CardContext);
  if (!context) throw new Error('useCards deve ser usado dentro de CardProvider.');
  return context;
}