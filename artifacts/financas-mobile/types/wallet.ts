export const DEFAULT_WALLET_ICON = 'wallet-outline' as const;
export type WalletIcon = typeof DEFAULT_WALLET_ICON;

export interface Wallet {
  id: string;
  title: string;
  initialBalance: number;
  icon: WalletIcon;
  isDefault: boolean;
  createdAt: string;
}

export interface NewWalletInput {
  title: string;
  initialBalance: number;
}