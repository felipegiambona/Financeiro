import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, type ImageSourcePropType } from 'react-native';
import { SvgUri } from 'react-native-svg';
import type { WalletIcon } from '@/types/wallet';

const LOGO_ASSETS: Partial<Record<WalletIcon, ImageSourcePropType>> = {
  'bank-outline': require('../assets/wallet-logos/itau.svg'),
  'credit-card-outline': require('../assets/wallet-logos/nubank.svg'),
  cash: require('../assets/wallet-logos/bradesco.svg'),
  'safe-square-outline': require('../assets/wallet-logos/caixa.svg'),
  wallet: require('../assets/wallet-logos/santander.svg'),
  'briefcase-outline': require('../assets/wallet-logos/banco-do-brasil.svg'),
  'bank-transfer': require('../assets/wallet-logos/inter.svg'),
  finance: require('../assets/wallet-logos/btg.png'),
  'card-account-details-outline': require('../assets/wallet-logos/picpay.svg'),
  recargapay: require('../assets/wallet-logos/recargapay.png'),
};

const WIDE_LOGOS = new Set<WalletIcon>([
  'wallet',
  'bank-transfer',
  'card-account-details-outline',
]);

function isPngAsset(icon: WalletIcon): boolean {
  return icon === 'finance' || icon === 'recargapay';
}

export function WalletIconView({
  icon,
  size = 21,
  color,
}: {
  icon: WalletIcon;
  size?: number;
  color: string;
}) {
  const asset = LOGO_ASSETS[icon];
  if (!asset) {
    return <MaterialCommunityIcons name={icon} size={size} color={color} />;
  }

  if (isPngAsset(icon)) {
    return <Image source={asset} resizeMode="contain" style={{ width: size, height: size }} />;
  }

  const uri = Image.resolveAssetSource(asset)?.uri;
  if (!uri) {
    return <MaterialCommunityIcons name={icon} size={size} color={color} />;
  }

  const width = WIDE_LOGOS.has(icon) ? size * 1.8 : size;
  const height = WIDE_LOGOS.has(icon) ? size * 0.72 : size;
  return <SvgUri uri={uri} width={width} height={height} />;
}