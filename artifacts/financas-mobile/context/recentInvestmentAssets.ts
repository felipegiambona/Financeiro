import type { InvestmentSearchResult } from '@workspace/api-client-react';

export type RecentInvestmentAsset = InvestmentSearchResult;

export const MAX_RECENT_INVESTMENT_ASSETS = 8;

const RECENT_INVESTMENT_ASSETS_KEY_PREFIX = '@financas-mobile/recent-investment-assets:';
const INVESTMENT_ASSET_TYPES = new Set<InvestmentSearchResult['assetType']>([
  'stock',
  'fii',
  'etf',
  'fund',
  'fixed_income',
  'crypto',
  'other',
]);

export type RecentInvestmentProfile = {
  id: string;
  type: 'personal' | 'business';
};

export function recentInvestmentAssetsStorageKey(profile: RecentInvestmentProfile | null | undefined): string | null {
  return profile?.type === 'personal' && profile.id
    ? `${RECENT_INVESTMENT_ASSETS_KEY_PREFIX}${profile.id}`
    : null;
}

export function recentInvestmentAssetKey(asset: RecentInvestmentAsset): string {
  return `${asset.assetType}:${asset.ticker.trim().toLocaleLowerCase() || asset.name.trim().toLocaleLowerCase()}`;
}

export function parseRecentInvestmentAssets(value: string | null): RecentInvestmentAsset[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is RecentInvestmentAsset => (
        typeof item === 'object'
        && item !== null
        && typeof item.name === 'string'
        && typeof item.ticker === 'string'
        && INVESTMENT_ASSET_TYPES.has(item.assetType)
      ))
      .slice(0, MAX_RECENT_INVESTMENT_ASSETS);
  } catch {
    return [];
  }
}

export function addRecentInvestmentAsset(
  current: RecentInvestmentAsset[],
  asset: RecentInvestmentAsset,
): RecentInvestmentAsset[] {
  return [
    asset,
    ...current.filter((item) => recentInvestmentAssetKey(item) !== recentInvestmentAssetKey(asset)),
  ].slice(0, MAX_RECENT_INVESTMENT_ASSETS);
}

export function removeRecentInvestmentAsset(
  current: RecentInvestmentAsset[],
  asset: RecentInvestmentAsset,
): RecentInvestmentAsset[] {
  return current.filter((item) => recentInvestmentAssetKey(item) !== recentInvestmentAssetKey(asset));
}