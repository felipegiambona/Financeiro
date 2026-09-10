export const WALLET_ICON_OPTIONS = [
  { icon: 'wallet-outline', label: 'Carteira' },
  { icon: 'bank-outline', label: 'Itaú' },
  { icon: 'credit-card-outline', label: 'Nubank' },
  { icon: 'cash', label: 'Bradesco' },
  { icon: 'safe-square-outline', label: 'Caixa' },
  { icon: 'wallet', label: 'Santander' },
  { icon: 'briefcase-outline', label: 'Banco do Brasil' },
  { icon: 'bank-transfer', label: 'Inter' },
  { icon: 'finance', label: 'BTG' },
  { icon: 'card-account-details-outline', label: 'PicPay' },
] as const;

export type WalletIcon = typeof WALLET_ICON_OPTIONS[number]['icon'];

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
  icon: WalletIcon;
}