import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  createInvestment as persistInvestment,
  deleteInvestment as removeInvestment,
  listInvestments,
  refreshInvestmentQuotes as persistInvestmentQuotes,
  searchInvestments as searchRemoteInvestments,
  updateInvestment as updatePersistedInvestment,
  type Investment,
  type InvestmentInput,
  type InvestmentSearchResult,
  type InvestmentUpdate,
} from '@workspace/api-client-react';
import { useFinancialProfiles } from '@/context/FinancialProfileContext';

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

function recentAssetKey(asset: RecentInvestmentAsset): string {
  return `${asset.assetType}:${asset.ticker.trim().toLocaleLowerCase() || asset.name.trim().toLocaleLowerCase()}`;
}

function parseRecentInvestmentAssets(value: string | null): RecentInvestmentAsset[] {
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

interface InvestmentContextValue {
  investments: Investment[];
  recentAssets: RecentInvestmentAsset[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  refreshQuotes: () => Promise<void>;
  searchInvestmentAssets: (query: string) => Promise<InvestmentSearchResult[]>;
  rememberRecentAsset: (asset: RecentInvestmentAsset) => Promise<void>;
  removeRecentAsset: (asset: RecentInvestmentAsset) => Promise<void>;
  createInvestment: (input: InvestmentInput) => Promise<Investment>;
  updateInvestment: (id: string, updates: InvestmentUpdate) => Promise<Investment>;
  toggleFavorite: (id: string) => Promise<Investment>;
  deleteInvestment: (id: string) => Promise<void>;
}

const InvestmentContext = createContext<InvestmentContextValue | null>(null);

export function InvestmentProvider({ children }: React.PropsWithChildren) {
  const { activeProfile } = useFinancialProfiles();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [recentAssets, setRecentAssets] = useState<RecentInvestmentAsset[]>([]);
  const recentAssetsRef = useRef<RecentInvestmentAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recentAssetsStorageKey = activeProfile?.type === 'personal' && activeProfile.id
    ? `${RECENT_INVESTMENT_ASSETS_KEY_PREFIX}${activeProfile.id}`
    : null;

  useEffect(() => {
    let mounted = true;
    recentAssetsRef.current = [];
    setRecentAssets([]);
    if (!recentAssetsStorageKey) return undefined;

    void AsyncStorage.getItem(recentAssetsStorageKey)
      .then((stored) => {
        if (!mounted) return;
        const loaded = parseRecentInvestmentAssets(stored);
        recentAssetsRef.current = loaded;
        setRecentAssets(loaded);
      })
      .catch(() => {
        // Local suggestions are optional and should not block the investment form.
      });

    return () => {
      mounted = false;
    };
  }, [recentAssetsStorageKey]);

  const rememberRecentAsset = useCallback(async (asset: RecentInvestmentAsset) => {
    if (!recentAssetsStorageKey) return;
    const next = [
      asset,
      ...recentAssetsRef.current.filter((current) => recentAssetKey(current) !== recentAssetKey(asset)),
    ].slice(0, MAX_RECENT_INVESTMENT_ASSETS);
    recentAssetsRef.current = next;
    setRecentAssets(next);
    try {
      await AsyncStorage.setItem(recentAssetsStorageKey, JSON.stringify(next));
    } catch {
      // Local suggestions are optional and should not block a saved investment.
    }
  }, [recentAssetsStorageKey]);

  const removeRecentAsset = useCallback(async (asset: RecentInvestmentAsset) => {
    if (!recentAssetsStorageKey) return;
    const next = recentAssetsRef.current.filter((current) => recentAssetKey(current) !== recentAssetKey(asset));
    recentAssetsRef.current = next;
    setRecentAssets(next);
    try {
      await AsyncStorage.setItem(recentAssetsStorageKey, JSON.stringify(next));
    } catch {
      // The UI update remains useful even if local storage is temporarily unavailable.
    }
  }, [recentAssetsStorageKey]);

  const refresh = useCallback(async () => {
    if (activeProfile?.type !== 'personal') {
      setInvestments([]);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setLoading(true);
      const loaded = await listInvestments();
      setInvestments(loaded);
      if (loaded.some((investment) => investment.valuationMode === 'automatic')) {
        try {
          setInvestments(await persistInvestmentQuotes());
        } catch {
          // Quote provider outages are shown per asset; they should not hide the portfolio.
        }
      }
    } catch {
      setError('Não foi possível carregar seus investimentos.');
    } finally {
      setLoading(false);
    }
  }, [activeProfile?.type]);

  useEffect(() => {
    void refresh();
    if (activeProfile?.type !== 'personal') return undefined;
    const interval = setInterval(() => void refresh(), 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [activeProfile?.type, refresh]);

  const refreshQuotes = useCallback(async () => {
    try {
      setInvestments(await persistInvestmentQuotes());
    } catch {
      throw new Error('Não foi possível atualizar as cotações agora.');
    }
  }, []);

  const searchInvestmentAssets = useCallback(async (query: string) => {
    if (activeProfile?.type !== 'personal') return [];
    return searchRemoteInvestments({ q: query });
  }, [activeProfile?.type]);

  const createInvestment = useCallback(async (input: InvestmentInput) => {
    try {
      setError(null);
      const created = await persistInvestment(input);
      setInvestments((current) => [...current, created]);
      return created;
    } catch {
      setError('Não foi possível salvar o investimento.');
      throw new Error('Não foi possível salvar o investimento.');
    }
  }, []);

  const updateInvestment = useCallback(async (id: string, updates: InvestmentUpdate) => {
    try {
      setError(null);
      const updated = await updatePersistedInvestment(id, updates);
      setInvestments((current) => current.map((investment) => investment.id === id ? updated : investment));
      return updated;
    } catch {
      setError('Não foi possível atualizar o investimento.');
      throw new Error('Não foi possível atualizar o investimento.');
    }
  }, []);

  const deleteInvestment = useCallback(async (id: string) => {
    try {
      setError(null);
      await removeInvestment(id);
      setInvestments((current) => current.filter((investment) => investment.id !== id));
    } catch {
      setError('Não foi possível excluir o investimento.');
      throw new Error('Não foi possível excluir o investimento.');
    }
  }, []);

  const toggleFavorite = useCallback(async (id: string) => {
    const current = investments.find((investment) => investment.id === id);
    if (!current) throw new Error('Investimento não encontrado.');
    try {
      setError(null);
      const updated = await updatePersistedInvestment(id, { isFavorite: !current.isFavorite });
      setInvestments((items) => items.map((investment) => investment.id === id ? updated : investment));
      return updated;
    } catch {
      setError('Não foi possível atualizar o favorito.');
      throw new Error('Não foi possível atualizar o favorito.');
    }
  }, [investments]);

  const value = useMemo(
    () => ({ investments, recentAssets, loading, error, refresh, refreshQuotes, searchInvestmentAssets, rememberRecentAsset, removeRecentAsset, createInvestment, updateInvestment, toggleFavorite, deleteInvestment }),
    [createInvestment, deleteInvestment, error, investments, loading, recentAssets, refresh, refreshQuotes, searchInvestmentAssets, rememberRecentAsset, removeRecentAsset, toggleFavorite, updateInvestment],
  );

  return <InvestmentContext.Provider value={value}>{children}</InvestmentContext.Provider>;
}

export function useInvestments(): InvestmentContextValue {
  const context = useContext(InvestmentContext);
  if (!context) throw new Error('useInvestments deve ser usado dentro de InvestmentProvider.');
  return context;
}