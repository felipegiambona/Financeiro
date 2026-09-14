import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addRecentInvestmentAsset,
  MAX_RECENT_INVESTMENT_ASSETS,
  parseRecentInvestmentAssets,
  recentInvestmentAssetsStorageKey,
  removeRecentInvestmentAsset,
} from '../context/recentInvestmentAssets.ts';

function asset(index, overrides = {}) {
  return {
    name: `Ativo ${index}`,
    ticker: `ATV${index}`,
    assetType: 'stock',
    ...overrides,
  };
}

test('restaura os ativos recentes ao reabrir o formulário', () => {
  const saved = [asset(1), asset(2)];
  const storage = JSON.stringify(saved);

  assert.deepEqual(parseRecentInvestmentAssets(storage), saved);
});

test('mantém o histórico isolado quando o perfil é trocado', () => {
  const personalProfile = { id: 'personal-1', type: 'personal' };
  const otherPersonalProfile = { id: 'personal-2', type: 'personal' };
  const storage = new Map([
    [recentInvestmentAssetsStorageKey(personalProfile), JSON.stringify([asset(1)])],
    [recentInvestmentAssetsStorageKey(otherPersonalProfile), JSON.stringify([asset(2)])],
  ]);

  assert.notEqual(
    recentInvestmentAssetsStorageKey(personalProfile),
    recentInvestmentAssetsStorageKey(otherPersonalProfile),
  );
  assert.equal(
    recentInvestmentAssetsStorageKey({ id: 'business-1', type: 'business' }),
    null,
  );
  assert.deepEqual(
    parseRecentInvestmentAssets(storage.get(recentInvestmentAssetsStorageKey(personalProfile))),
    [asset(1)],
  );
  assert.deepEqual(
    parseRecentInvestmentAssets(storage.get(recentInvestmentAssetsStorageKey(otherPersonalProfile))),
    [asset(2)],
  );
  assert.deepEqual(
    parseRecentInvestmentAssets(storage.get(recentInvestmentAssetsStorageKey({ id: 'personal-3', type: 'personal' }))),
    [],
  );
});

test('remove individualmente um ativo e limita o histórico a oito itens', () => {
  const allAssets = Array.from({ length: MAX_RECENT_INVESTMENT_ASSETS + 2 }, (_, index) => asset(index));
  const limited = allAssets.reduce(addRecentInvestmentAsset, []);

  assert.equal(limited.length, MAX_RECENT_INVESTMENT_ASSETS);
  assert.deepEqual(limited, allAssets.slice(-MAX_RECENT_INVESTMENT_ASSETS).reverse());
  assert.deepEqual(
    removeRecentInvestmentAsset(limited, asset(5)),
    limited.filter((item) => item.ticker !== 'ATV5'),
  );
});