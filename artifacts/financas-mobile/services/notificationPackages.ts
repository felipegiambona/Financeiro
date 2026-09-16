export const DEFAULT_NOTIFICATION_PACKAGES = [
  'com.nu.production',
  'br.com.intermedium',
  'br.com.intermedium.pf',
  'com.c6bank.app',
  'com.mercadopago.wallet',
  'br.com.uol.ps.myaccount',
  'com.picpay',
  'br.com.neon',
  'br.com.bradesco.next',
  'com.superdigital.voto',
  'com.itau',
  'com.itau.personnalite',
  'br.com.bb.android',
  'com.bradesco',
  'com.bradesco.prime',
  'com.gabba.Caixa',
  'com.santander.app',
  'com.itau.empresas',
  'com.bradesco.netempresa',
  'br.com.bb.android.pj',
  'com.santander.appcorporativo',
  'br.gov.caixa.tem',
  'br.com.bancopan',
  'br.com.banrisul.bancovirtual',
  'com.safra.safra',
  'com.btg.pactual.banking',
  'br.com.sicoob.cooperado',
  'br.com.sicredi.mobile',
  'br.com.xp.carteira',
  'br.com.rico.ricoapp',
  'br.com.clear.corretora',
  'com.btg.pactual.investimentos',
  'com.agorainvestimentos',
  'us.avenue.app',
  'br.com.easynext',
  'br.com.oramainvestimentos.oramamobile',
  'br.com.guideinvestimentos.guideapp',
  'com.toroinvestimentos.android',
  'br.com.novafutura.mob',
  'br.com.genialinvestimentos.app',
  'com.itau.ion',
  'br.com.bb.investimentos',
] as const;

export function normalizeNotificationPackages(packages: readonly unknown[]): string[] {
  return Array.from(new Set(
    packages
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean),
  ));
}