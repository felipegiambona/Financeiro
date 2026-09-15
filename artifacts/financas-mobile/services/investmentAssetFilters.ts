import type { Investment, InvestmentAssetType, InvestmentFavorite } from '@workspace/api-client-react';

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

export function searchInvestmentsByNameOrTicker(
  investments: Investment[],
  routeFilter: InvestmentAssetTypeRouteFilter,
  query: string,
): Investment[] {
  const filteredInvestments = filterInvestmentsByAssetType(investments, routeFilter);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return filteredInvestments;

  return filteredInvestments.filter((investment) => (
    investment.name.toLocaleLowerCase().includes(normalizedQuery)
    || (investment.ticker ?? '').toLocaleLowerCase().includes(normalizedQuery)
  ));
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

export type FavoriteListItem =
  | { kind: 'investment'; item: Investment }
  | { kind: 'catalog'; item: InvestmentFavorite };

function favoriteAssetKey(asset: { assetType: InvestmentAssetType; ticker: string | null; name: string }): string {
  return `${asset.assetType}:${asset.ticker?.trim().toLocaleLowerCase() || asset.name.trim().toLocaleLowerCase()}`;
}

export function composeFavoriteItems(
  investments: Investment[],
  favoriteAssets: InvestmentFavorite[],
  selectedAssetType: InvestmentAssetType | null = null,
): FavoriteListItem[] {
  const favoritePortfolioInvestments = investments.filter((investment) => (
    investment.isFavorite
      && (!selectedAssetType || investment.assetType === selectedAssetType)
  ));
  const portfolioKeys = new Set(favoritePortfolioInvestments.map(favoriteAssetKey));
  const typeOrder = new Map(INVESTMENT_ASSET_TYPES.map((assetType, index) => [assetType, index]));

  return [
    ...favoritePortfolioInvestments.map((investment) => ({ kind: 'investment' as const, item: investment })),
    ...favoriteAssets
      .filter((favorite) => (
        (!selectedAssetType || favorite.assetType === selectedAssetType)
        && !portfolioKeys.has(favoriteAssetKey(favorite))
      ))
      .map((favorite) => ({ kind: 'catalog' as const, item: favorite })),
  ].sort((first, second) => {
    const typeDifference = (typeOrder.get(first.item.assetType) ?? INVESTMENT_ASSET_TYPES.length)
      - (typeOrder.get(second.item.assetType) ?? INVESTMENT_ASSET_TYPES.length);
    if (typeDifference !== 0) return typeDifference;
    return first.item.name.localeCompare(second.item.name, 'pt-BR');
  });
}

export function countFavoriteItemsByAssetType(
  favoriteItems: FavoriteListItem[],
): Map<InvestmentAssetType, number> {
  const counts = new Map<InvestmentAssetType, number>();
  favoriteItems.forEach(({ item }) => {
    counts.set(item.assetType, (counts.get(item.assetType) ?? 0) + 1);
  });
  return counts;
}

export function toggleFavoriteGroup(
  expandedTypes: ReadonlySet<InvestmentAssetType>,
  assetType: InvestmentAssetType,
): Set<InvestmentAssetType> {
  const next = new Set(expandedTypes);
  if (next.has(assetType)) next.delete(assetType);
  else next.add(assetType);
  return next;
}

export function investmentCompositionRoute(assetType: InvestmentAssetType) {
  return {
    pathname: '/more/investments' as const,
    params: { assetType },
  };
}