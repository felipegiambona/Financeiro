import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { WalletIcon } from '@/types/wallet';

export function WalletIconView({
  size = 21,
  color,
}: {
  icon?: WalletIcon;
  size?: number;
  color: string;
}) {
  return <MaterialCommunityIcons name="wallet-outline" size={size} color={color} />;
}