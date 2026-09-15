import type { Investment, InvestmentAssetType } from '@workspace/api-client-react';

export const INVESTMENT_ASSET_TYPES = [
  'stock',
  'fii',
  'etf',
  'fund',
  'fixed_income',
  'crypto',
  'other',
] as const satisfies readonly InvestmentAssetType[];

export const INVESTMENT_ASSET_TYPE_LABELS: Record<InvestmentAssetType, string> = {
  stock: 'Ações',
  fii: 'FIIs',
  etf: 'ETFs',
  fund: 'Fundos',
  fixed_income: 'Renda fixa',
  crypto: 'Cripto',
  other: 'Outros',
};

export function isInvestmentAssetType(value: unknown): value is InvestmentAssetType {
  return typeof value === 'string'
    && (INVESTMENT_ASSET_TYPES as readonly string[]).includes(value);
}

export type InvestmentAssetTypeRouteFilter = {
  assetType: InvestmentAssetType | null;
  invalid: boolean;
};

export function resolveInvestmentAssetTypeParam(
  param: string | string[] | undefined,
): InvestmentAssetTypeRouteFilter {
  if (param === undefined) return { assetType: null, invalid: false };

  if (Array.isArray(param)) {
    if (param.length !== 1) return { assetType: null, invalid: param.length > 1 };
    return isInvestmentAssetType(param[0])
      ? { assetType: param[0], invalid: false }
      : { assetType: null, invalid: true };
  }

  return isInvestmentAssetType(param)
    ? { assetType: param, invalid: false }
    : { assetType: null, invalid: true };
}

export function filterInvestmentsByAssetType(
  investments: Investment[],
  routeFilter: InvestmentAssetTypeRouteFilter,
): Investment[] {
  if (routeFilter.invalid) return [];
  if (!routeFilter.assetType) return investments;
  return investments.filter((investment) => investment.assetType === routeFilter.assetType);
}

export type InvestmentSummary = {
  invested: number;
  current: number;
  result: number;
};

export function summarizeInvestments(investments: Investment[]): InvestmentSummary {
  return investments.reduce(
    (summary, investment) => ({
      invested: summary.invested + investment.investedAmount,
      current: summary.current + investment.currentValue,
      result: summary.result + investment.returnAmount,
    }),
    { invested: 0, current: 0, result: 0 },
  );
}

export function investmentCompositionRoute(assetType: InvestmentAssetType) {
  return {
    pathname: '/more/investments' as const,
    params: { assetType },
  };
}