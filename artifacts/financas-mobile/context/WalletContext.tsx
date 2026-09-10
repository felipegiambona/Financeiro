import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createWallet as persistWallet,
  deleteWallet as removeWallet,
  getWallets,
  updateWallet as updatePersistedWallet,
} from '@/services/walletRepository';
import type { NewWalletInput, Wallet } from '@/types/wallet';

interface WalletContextValue {
  wallets: Wallet[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createWallet: (input: NewWalletInput) => Promise<void>;
  updateWallet: (id: string, updates: Partial<Omit<Wallet, 'id' | 'createdAt'>>) => Promise<void>;
  deleteWallet: (id: string) => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: React.PropsWithChildren) {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      setWallets(await getWallets());
    } catch {
      setError('Não foi possível carregar suas carteiras.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createWallet = useCallback(async (input: NewWalletInput) => {
    try {
      setError(null);
      await persistWallet(input);
      await refresh();
    } catch {
      setError('Não foi possível salvar a carteira.');
      throw new Error('Não foi possível salvar a carteira.');
    }
  }, [refresh]);

  const updateWallet = useCallback(async (
    id: string,
    updates: Partial<Omit<Wallet, 'id' | 'createdAt'>>,
  ) => {
    try {
      setError(null);
      await updatePersistedWallet(id, updates);
      await refresh();
    } catch {
      setError('Não foi possível atualizar a carteira.');
      throw new Error('Não foi possível atualizar a carteira.');
    }
  }, [refresh]);

  const deleteWallet = useCallback(async (id: string) => {
    try {
      setError(null);
      await removeWallet(id);
      await refresh();
    } catch {
      setError('Não foi possível excluir a carteira.');
      throw new Error('Não foi possível excluir a carteira.');
    }
  }, [refresh]);

  const value = useMemo(
    () => ({ wallets, loading, error, refresh, createWallet, updateWallet, deleteWallet }),
    [createWallet, deleteWallet, error, loading, refresh, updateWallet, wallets],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallets(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallets deve ser usado dentro de WalletProvider.');
  return context;
}