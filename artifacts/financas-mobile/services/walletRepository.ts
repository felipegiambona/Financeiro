import {
  createWallet as createWalletRequest,
  deleteWallet as deleteWalletRequest,
  listWallets,
  updateWallet as updateWalletRequest,
} from '@workspace/api-client-react';
import type { NewWalletInput, Wallet } from '@/types/wallet';

function normalizeWallet(value: Wallet): Wallet {
  return {
    ...value,
    initialBalance: Number(value.initialBalance),
  };
}

export async function getWallets(): Promise<Wallet[]> {
  const wallets = await listWallets();
  return wallets.map((wallet) => normalizeWallet(wallet as Wallet));
}

export async function createWallet(input: NewWalletInput): Promise<Wallet> {
  const wallet = await createWalletRequest(input);
  return normalizeWallet(wallet as Wallet);
}

export async function updateWallet(id: string, updates: Partial<Omit<Wallet, 'id' | 'createdAt'>>): Promise<Wallet> {
  const wallet = await updateWalletRequest(id, updates);
  return normalizeWallet(wallet as Wallet);
}

export async function deleteWallet(id: string): Promise<void> {
  await deleteWalletRequest(id);
}