import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  createInvestmentFavorite as persistInvestmentFavorite,
  createInvestment as persistInvestment,
  deleteInvestmentFavorite as removeInvestmentFavorite,
  deleteInvestment as removeInvestment,
  getInvestmentQuote as fetchInvestmentQuote,
  listInvestmentFavorites,
  listInvestments,
  refreshInvestmentQuotes as persistInvestmentQuotes,
  searchInvestments as searchRemoteInvestments,
  updateInvestment as updatePersistedInvestment,
  type Investment,
  type InvestmentFavorite,
  type InvestmentFavoriteInput,
  type InvestmentInput,
  type InvestmentAssetType,
  type InvestmentSearchResult,
  type InvestmentUpdate,
} from '@workspace/api-client-react';
import { useFinancialProfiles } from '@/context/FinancialProfileContext';
import {
  addRecentInvestmentAsset,
  MAX_RECENT_INVESTMENT_ASSETS,
  parseRecentInvestmentAssets,
  recentInvestmentAssetKey,
  recentInvestmentAssetsStorageKey,
  removeRecentInvestmentAsset,
  type RecentInvestmentAsset,
} from '@/context/recentInvestmentAssets';

export { MAX_RECENT_INVESTMENT_ASSETS, type RecentInvestmentAsset } from '@/context/recentInvestmentAssets';

export type InvestmentCatalogSearch = {
  results: InvestmentSearchResult[];
  status: 'available' | 'unavailable';
};

function isLegacyFavoriteDraft(investment: Investment): boolean {
  return investment.isFavorite
    && investment.quantity === 0
    && investment.averagePrice === 0
    && investment.investedAmount === 0
    && investment.currentValue === 0;
}

interface InvestmentContextValue {
  investments: Investment[];
  favoriteAssets: InvestmentFavorite[];
  recentAssets: RecentInvestmentAsset[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  refreshQuotes: () => Promise<void>;
  getInvestmentQuote: (assetType: InvestmentAssetType, ticker: string) => Promise<number>;
  searchInvestmentAssets: (query: string) => Promise<InvestmentCatalogSearch>;
  rememberRecentAsset: (asset: RecentInvestmentAsset) => Promise<void>;
  removeRecentAsset: (asset: RecentInvestmentAsset) => Promise<void>;
  clearRecentAssets: () => Promise<void>;
  createInvestment: (input: InvestmentInput) => Promise<Investment>;
  createFavoriteAsset: (input: InvestmentFavoriteInput) => Promise<InvestmentFavorite>;
  deleteFavoriteAsset: (id: string) => Promise<void>;
  updateInvestment: (id: string, updates: InvestmentUpdate) => Promise<Investment>;
  toggleFavorite: (id: string) => Promise<Investment>;
  deleteInvestment: (id: string) => Promise<void>;
}

const InvestmentContext = createContext<InvestmentContextValue | null>(null);

export function InvestmentProvider({ children }: React.PropsWithChildren) {
  const { activeProfile } = useFinancialProfiles();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [favoriteAssets, setFavoriteAssets] = useState<InvestmentFavorite[]>([]);
  const [recentAssets, setRecentAssets] = useState<RecentInvestmentAsset[]>([]);
  const recentAssetsRef = useRef<RecentInvestmentAsset[]>([]);
  const hasLoadedRef = useRef(false);
  const refreshInFlightRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recentAssetsStorageKey = recentInvestmentAssetsStorageKey(activeProfile);

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
    const next = addRecentInvestmentAsset(recentAssetsRef.current, asset);
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
    const next = removeRecentInvestmentAsset(recentAssetsRef.current, asset);
    recentAssetsRef.current = next;
    setRecentAssets(next);
    try {
      await AsyncStorage.setItem(recentAssetsStorageKey, JSON.stringify(next));
    } catch {
      // The UI update remains useful even if local storage is temporarily unavailable.
    }
  }, [recentAssetsStorageKey]);

  const clearRecentAssets = useCallback(async () => {
    if (!recentAssetsStorageKey) return;
    recentAssetsRef.current = [];
    setRecentAssets([]);
    try {
      await AsyncStorage.removeItem(recentAssetsStorageKey);
    } catch {
      // The UI update remains useful even if local storage is temporarily unavailable.
    }
  }, [recentAssetsStorageKey]);

  const refresh = useCallback(async () => {
    if (activeProfile?.type !== 'personal') {
      hasLoadedRef.current = true;
      setInvestments([]);
      setFavoriteAssets([]);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    const isInitialLoad = !hasLoadedRef.current;
    try {
      setError(null);
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      const [loaded, loadedFavorites] = await Promise.all([listInvestments(), listInvestmentFavorites()]);
      const legacyDrafts = loaded.filter(isLegacyFavoriteDraft);
      let nextFavorites = loadedFavorites;
      if (legacyDrafts.length > 0) {
        const migrated = await Promise.all(legacyDrafts.map((investment) => persistInvestmentFavorite({
          name: investment.name,
          ticker: investment.ticker ?? '',
          assetType: investment.assetType,
        })));
        nextFavorites = [
          ...nextFavorites,
          ...migrated.filter((favorite) => !nextFavorites.some((current) => current.id === favorite.id)),
        ];
        await Promise.all(legacyDrafts.map((investment) => removeInvestment(investment.id)));
      }
      const portfolio = loaded.filter((investment) => !isLegacyFavoriteDraft(investment));
      setFavoriteAssets(nextFavorites);
      setInvestments(portfolio);
      hasLoadedRef.current = true;
      if (portfolio.some((investment) => investment.valuationMode === 'automatic')) {
        try {
          setInvestments(await persistInvestmentQuotes());
        } catch {
          // Quote provider outages are shown per asset; they should not hide the portfolio.
        }
      }
    } catch {
      setError('Não foi possível carregar seus investimentos.');
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
      refreshInFlightRef.current = false;
    }
  }, [activeProfile?.type]);

  useEffect(() => {
    hasLoadedRef.current = false;
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

  const getInvestmentQuote = useCallback(async (assetType: InvestmentAssetType, ticker: string) => {
    const response = await fetchInvestmentQuote({ assetType, ticker });
    return response.price;
  }, []);

  const searchInvestmentAssets = useCallback(async (query: string) => {
    if (activeProfile?.type !== 'personal') return { results: [], status: 'available' as const };
    try {
      return {
        results: await searchRemoteInvestments({ q: query }),
        status: 'available' as const,
      };
    } catch {
      return { results: [], status: 'unavailable' as const };
    }
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

  const createFavoriteAsset = useCallback(async (input: InvestmentFavoriteInput) => {
    try {
      setError(null);
      const created = await persistInvestmentFavorite(input);
      setFavoriteAssets((current) => current.some((favorite) => favorite.id === created.id)
        ? current
        : [...current, created]);
      return created;
    } catch {
      setError('Não foi possível salvar o favorito.');
      throw new Error('Não foi possível salvar o favorito.');
    }
  }, []);

  const deleteFavoriteAsset = useCallback(async (id: string) => {
    try {
      setError(null);
      await removeInvestmentFavorite(id);
      setFavoriteAssets((current) => current.filter((favorite) => favorite.id !== id));
    } catch {
      setError('Não foi possível remover o favorito.');
      throw new Error('Não foi possível remover o favorito.');
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
    const optimistic = { ...current, isFavorite: !current.isFavorite };
    try {
      setError(null);
      setInvestments((items) => items.map((investment) => investment.id === id ? optimistic : investment));
      const updated = await updatePersistedInvestment(id, { isFavorite: !current.isFavorite });
      setInvestments((items) => items.map((investment) => investment.id === id ? updated : investment));
      return updated;
    } catch {
      setInvestments((items) => items.map((investment) => investment.id === id ? current : investment));
      setError('Não foi possível atualizar o favorito.');
      throw new Error('Não foi possível atualizar o favorito.');
    }
  }, [investments]);

  const value = useMemo(
    () => ({ investments, favoriteAssets, recentAssets, loading, refreshing, error, refresh, refreshQuotes, getInvestmentQuote, searchInvestmentAssets, rememberRecentAsset, removeRecentAsset, clearRecentAssets, createInvestment, createFavoriteAsset, deleteFavoriteAsset, updateInvestment, toggleFavorite, deleteInvestment }),
    [clearRecentAssets, createFavoriteAsset, createInvestment, deleteFavoriteAsset, deleteInvestment, error, favoriteAssets, getInvestmentQuote, investments, loading, recentAssets, refresh, refreshing, refreshQuotes, searchInvestmentAssets, rememberRecentAsset, removeRecentAsset, toggleFavorite, updateInvestment],
  );

  return <InvestmentContext.Provider value={value}>{children}</InvestmentContext.Provider>;
}

export function useInvestments(): InvestmentContextValue {
  const context = useContext(InvestmentContext);
  if (!context) throw new Error('useInvestments deve ser usado dentro de InvestmentProvider.');
  return context;
}