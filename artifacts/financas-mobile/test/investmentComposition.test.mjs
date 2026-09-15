import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterInvestmentsByAssetType,
  composeFavoriteItems,
  countFavoriteItemsByAssetType,
  investmentCompositionRoute,
  INVESTMENT_ASSET_TYPES,
  resolveInvestmentAssetTypeParam,
  summarizeInvestments,
} from '../services/investmentAssetFilters.ts';

function investment(assetType, values = {}) {
  return {
    id: `${assetType}-${values.name ?? 'asset'}`,
    name: values.name ?? assetType,
    assetType,
    investedAmount: values.investedAmount ?? 100,
    currentValue: values.currentValue ?? 110,
    returnAmount: values.returnAmount ?? 10,
  };
}

function favorite(assetType, values = {}) {
  return {
    id: `favorite-${assetType}-${values.name ?? 'asset'}`,
    name: values.name ?? assetType,
    ticker: values.ticker ?? `${assetType.toUpperCase()}1`,
    assetType,
    createdAt: '2026-09-15T00:00:00.000Z',
    updatedAt: '2026-09-15T00:00:00.000Z',
  };
}

const investments = [
  investment('stock', { name: 'Ação', investedAmount: 100, currentValue: 120, returnAmount: 20 }),
  investment('fii', { name: 'FII', investedAmount: 200, currentValue: 180, returnAmount: -20 }),
  investment('crypto', { name: 'Cripto', investedAmount: 50, currentValue: 75, returnAmount: 25 }),
];

test('cada tipo da composição aponta para a carteira com o mesmo tipo', () => {
  for (const assetType of INVESTMENT_ASSET_TYPES) {
    assert.deepEqual(investmentCompositionRoute(assetType), {
      pathname: '/more/investments',
      params: { assetType },
    });
  }
});

test('filtra a carteira e recalcula o resumo apenas para o tipo selecionado', () => {
  const routeFilter = resolveInvestmentAssetTypeParam('fii');
  const selectedInvestments = filterInvestmentsByAssetType(investments, routeFilter);

  assert.deepEqual(selectedInvestments.map((item) => item.name), ['FII']);
  assert.deepEqual(summarizeInvestments(selectedInvestments), {
    invested: 200,
    current: 180,
    result: -20,
  });
});

test('parâmetro inválido não remove o filtro e não exibe outra classe', () => {
  const routeFilter = resolveInvestmentAssetTypeParam('invalid');

  assert.deepEqual(routeFilter, { assetType: null, invalid: true });
  assert.deepEqual(filterInvestmentsByAssetType(investments, routeFilter), []);
});

test('sem parâmetro mantém a carteira completa e lista vazia continua vazia', () => {
  assert.deepEqual(
    filterInvestmentsByAssetType(investments, resolveInvestmentAssetTypeParam(undefined)),
    investments,
  );
  assert.deepEqual(
    filterInvestmentsByAssetType([], resolveInvestmentAssetTypeParam('stock')),
    [],
  );
});

test('mantém favoritos da carteira e do catálogo agrupados por tipo após recarregar', () => {
  const firstLoad = composeFavoriteItems(
    [
      investment('stock', { name: 'Ação na carteira' }),
      investment('fii', { name: 'FII na carteira' }),
    ].map((item) => ({ ...item, isFavorite: true, ticker: `${item.assetType.toUpperCase()}1` })),
    [
      favorite('stock', { name: 'Ação no catálogo', ticker: 'STK2' }),
      favorite('crypto', { name: 'Cripto no catálogo', ticker: 'BTC' }),
    ],
  );

  assert.deepEqual(
    firstLoad.map(({ item }) => `${item.assetType}:${item.name}`),
    [
      'stock:Ação na carteira',
      'stock:Ação no catálogo',
      'fii:FII na carteira',
      'crypto:Cripto no catálogo',
    ],
  );
  assert.deepEqual(
    [...countFavoriteItemsByAssetType(firstLoad).entries()],
    [['stock', 2], ['fii', 1], ['crypto', 1]],
  );

  const reloaded = composeFavoriteItems(
    [
      investment('stock', { name: 'Ação na carteira' }),
      investment('fii', { name: 'FII na carteira' }),
    ].map((item) => ({ ...item, isFavorite: true, ticker: `${item.assetType.toUpperCase()}1` })),
    [
      favorite('stock', { name: 'Ação no catálogo', ticker: 'STK2' }),
      favorite('crypto', { name: 'Cripto no catálogo', ticker: 'BTC' }),
      favorite('etf', { name: 'ETF no catálogo', ticker: 'ETF1' }),
    ],
  );

  assert.deepEqual(
    reloaded.map(({ item }) => `${item.assetType}:${item.name}`),
    [
      'stock:Ação na carteira',
      'stock:Ação no catálogo',
      'fii:FII na carteira',
      'etf:ETF no catálogo',
      'crypto:Cripto no catálogo',
    ],
  );
  assert.deepEqual(
    [...countFavoriteItemsByAssetType(reloaded).entries()],
    [['stock', 2], ['fii', 1], ['etf', 1], ['crypto', 1]],
  );
});
