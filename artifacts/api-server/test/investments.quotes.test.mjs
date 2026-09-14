import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fetchBcbSgsQuote,
  fetchBrapiQuote,
  fetchCoinGeckoQuote,
  fetchCvmFundQuote,
  normalizeQuoteIdentifier,
  quoteIdentifierError,
  quoteProviderForAssetType,
  quoteSourceForAssetType,
  refreshInvestmentQuote,
} from "../src/lib/investmentQuotes.ts";

const now = new Date("2026-09-14T12:00:00.000Z");

function investment(overrides = {}) {
  return {
    id: "investment-id",
    userId: "user-id",
    profileId: "profile-id",
    name: "Ação de teste",
    ticker: "TEST3",
    assetType: "stock",
    institution: "Corretora",
    quantity: "4",
    averagePrice: "20",
    investedAmount: "80",
    currentValue: "111",
    manualCurrentValue: "99",
    valuationMode: "automatic",
    quoteSource: "BRAPI",
    quotePrice: "27.75",
    quoteStatus: "pending",
    quoteError: null,
    lastQuoteAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function controlledStore() {
  const calls = [];
  return {
    calls,
    store: {
      async markUnavailable(row) {
        calls.push({ type: "unavailable", row });
        return { ...row, quoteStatus: "unavailable" };
      },
      async markUpdated(row, quotePrice, quoteAt) {
        calls.push({ type: "updated", row, quotePrice, quoteAt });
        return {
          ...row,
          currentValue: String(Math.round(quotePrice * Number(row.quantity) * 100) / 100),
          quotePrice: String(quotePrice),
          quoteStatus: "updated",
          quoteError: null,
          lastQuoteAt: quoteAt,
        };
      },
      async markError(row) {
        calls.push({ type: "error", row });
        return {
          ...row,
          quoteSource: quoteSourceForAssetType(row.assetType),
          quoteStatus: "error",
          quoteError: "Não foi possível obter a cotação agora. O último valor foi mantido.",
        };
      },
    },
  };
}

async function withMockFetch(response, callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => response.json,
    text: async () => response.text,
  });
  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

describe("investment quote refresh", () => {
  it("documents a dedicated source and identifier format for each supported class", () => {
    assert.equal(quoteSourceForAssetType("stock"), "BRAPI");
    assert.equal(quoteSourceForAssetType("fii"), "BRAPI");
    assert.equal(quoteSourceForAssetType("etf"), "BRAPI");
    assert.equal(quoteSourceForAssetType("fund"), "CVM");
    assert.equal(quoteSourceForAssetType("fixed_income"), "BCB_SGS");
    assert.equal(quoteSourceForAssetType("crypto"), "COINGECKO");
    assert.equal(quoteSourceForAssetType("other"), null);

    assert.equal(quoteIdentifierError("fund", "00.000.000/0001-00"), null);
    assert.equal(normalizeQuoteIdentifier("crypto", "Bitcoin"), "bitcoin");
    assert.equal(quoteIdentifierError("crypto", "BTC"), "Use ID do CoinGecko no formato esperado (ex.: bitcoin).");
    assert.equal(quoteIdentifierError("fixed_income", "Selic"), "Use Código da série BCB SGS no formato esperado (ex.: 1178).");
    assert.equal(quoteIdentifierError("stock", "B3SA3"), null);
  });

  it("routes supported classes to their matching provider", () => {
    assert.equal(quoteProviderForAssetType("stock")?.name, "fetchBrapiQuote");
    assert.equal(quoteProviderForAssetType("fund")?.name, "fetchCvmFundQuote");
    assert.equal(quoteProviderForAssetType("fixed_income")?.name, "fetchBcbSgsQuote");
    assert.equal(quoteProviderForAssetType("crypto")?.name, "fetchCoinGeckoQuote");
    assert.equal(quoteProviderForAssetType("other"), null);
  });

  it("keeps a contract for valid responses from every quote source", async () => {
    await withMockFetch({
      json: { results: [{ regularMarketPrice: 37.42 }] },
    }, async () => {
      assert.equal(await fetchBrapiQuote("PETR4"), 37.42);
    });

    await withMockFetch({
      text: [
        "TP_FUNDO;CNPJ_FUNDO;DT_COMPTC;VL_TOTAL;VL_QUOTA;VL_PATRIM_LIQ",
        "FI;00.000.000/0001-91;2026-09-13;1000,00;12,3456;900,00",
      ].join("\n"),
    }, async () => {
      assert.equal(await fetchCvmFundQuote("00.000.000/0001-91"), 12.3456);
    });

    await withMockFetch({
      json: [{ valor: "13,57" }],
    }, async () => {
      assert.equal(await fetchBcbSgsQuote("1178"), 13.57);
    });

    await withMockFetch({
      json: { bitcoin: { brl: 345678.9 } },
    }, async () => {
      assert.equal(await fetchCoinGeckoQuote("bitcoin"), 345678.9);
    });
  });

  it("falls back to Yahoo Finance when BRAPI requires authentication", async () => {
    const originalFetch = globalThis.fetch;
    let requestCount = 0;
    globalThis.fetch = async () => {
      requestCount += 1;
      if (requestCount === 1) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: true }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          chart: {
            result: [{ meta: { regularMarketPrice: 6.05 } }],
          },
        }),
      };
    };
    try {
      assert.equal(await fetchBrapiQuote("KISU11"), 6.05);
      assert.equal(requestCount, 2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects invalid responses from every quote source", async () => {
    await withMockFetch({
      json: { results: [{ regularMarketPrice: "37.42" }] },
    }, async () => {
      await assert.rejects(fetchBrapiQuote("PETR4"), /invalid price/);
    });

    await withMockFetch({
      text: [
        "TP_FUNDO;CNPJ_FUNDO;DT_COMPTC;VL_TOTAL;VL_QUOTA;VL_PATRIM_LIQ",
        "FI;00.000.000/0001-91;2026-09-13;1000,00;not-a-price;900,00",
      ].join("\n"),
    }, async () => {
      await assert.rejects(
        fetchCvmFundQuote("00.000.000/0001-92"),
        /no quote for this fund CNPJ/,
      );
    });

    await withMockFetch({
      json: [{ valor: "not-a-number" }],
    }, async () => {
      await assert.rejects(fetchBcbSgsQuote("1178"), /invalid series value/);
    });

    await withMockFetch({
      json: { bitcoin: { brl: null } },
    }, async () => {
      await assert.rejects(fetchCoinGeckoQuote("bitcoin"), /no BRL price/);
    });
  });

  it("preserves the last value and records the matching source when a source fails", async () => {
    const previousQuoteAt = new Date("2026-09-14T11:00:00.000Z");
    const cases = [
      { assetType: "stock", ticker: "TEST3", source: "BRAPI" },
      { assetType: "fund", ticker: "00.000.000/0001-91", source: "CVM" },
      { assetType: "fixed_income", ticker: "1178", source: "BCB_SGS" },
      { assetType: "crypto", ticker: "bitcoin", source: "COINGECKO" },
    ];

    for (const { assetType, ticker, source } of cases) {
      const controlled = controlledStore();
      const refreshed = await refreshInvestmentQuote(investment({
        assetType,
        ticker,
        quoteSource: "stale-source",
        quoteStatus: "updated",
        quotePrice: "27.75",
        currentValue: "123.45",
        manualCurrentValue: "99",
        lastQuoteAt: previousQuoteAt,
      }), {
        quoteProvider: async () => {
          throw new Error(`${source} offline`);
        },
        store: controlled.store,
        now: () => now,
      });

      assert.equal(refreshed.currentValue, "123.45");
      assert.equal(refreshed.quotePrice, "27.75");
      assert.equal(refreshed.manualCurrentValue, "99");
      assert.equal(refreshed.lastQuoteAt, previousQuoteAt);
      assert.equal(refreshed.quoteSource, source);
      assert.equal(refreshed.quoteStatus, "error");
      assert.equal(refreshed.quoteError, "Não foi possível obter a cotação agora. O último valor foi mantido.");
      assert.deepEqual(controlled.calls.map(({ type }) => type), ["error"]);
    }
  });

  it("applies a controlled quote without changing the manual value", async () => {
    const controlled = controlledStore();
    const refreshed = await refreshInvestmentQuote(investment(), {
      quoteProvider: async (ticker) => {
        assert.equal(ticker, "TEST3");
        return 17.25;
      },
      store: controlled.store,
      now: () => now,
    });

    assert.equal(refreshed.currentValue, "69");
    assert.equal(refreshed.manualCurrentValue, "99");
    assert.equal(refreshed.quoteStatus, "updated");
    assert.equal(refreshed.lastQuoteAt, now);
    assert.deepEqual(controlled.calls.map(({ type }) => type), ["updated"]);
  });

  it("marks provider failures as errors while preserving value and quote time", async () => {
    const previousQuoteAt = new Date("2026-09-14T11:00:00.000Z");
    const controlled = controlledStore();
    const refreshed = await refreshInvestmentQuote(investment({
      currentValue: "123.45",
      manualCurrentValue: "99",
      quoteStatus: "updated",
      lastQuoteAt: previousQuoteAt,
    }), {
      quoteProvider: async () => {
        throw new Error("provider offline");
      },
      store: controlled.store,
      now: () => now,
    });

    assert.equal(refreshed.currentValue, "123.45");
    assert.equal(refreshed.manualCurrentValue, "99");
    assert.equal(refreshed.quoteStatus, "error");
    assert.equal(refreshed.lastQuoteAt, previousQuoteAt);
    assert.deepEqual(controlled.calls.map(({ type }) => type), ["error"]);
  });

  it("marks investments without a ticker as unavailable without calling the provider", async () => {
    let providerCalled = false;
    const controlled = controlledStore();
    const refreshed = await refreshInvestmentQuote(investment({
      ticker: null,
      currentValue: "456.78",
      manualCurrentValue: "321",
    }), {
      quoteProvider: async () => {
        providerCalled = true;
        return 1;
      },
      store: controlled.store,
      now: () => now,
    });

    assert.equal(providerCalled, false);
    assert.equal(refreshed.currentValue, "456.78");
    assert.equal(refreshed.manualCurrentValue, "321");
    assert.equal(refreshed.quoteStatus, "unavailable");
    assert.equal(refreshed.lastQuoteAt, null);
    assert.deepEqual(controlled.calls.map(({ type }) => type), ["unavailable"]);
  });

  it("does not refresh a manual investment", async () => {
    let providerCalled = false;
    const controlled = controlledStore();
    const manual = investment({
      valuationMode: "manual",
      currentValue: "88",
      manualCurrentValue: "88",
      quoteStatus: "not_configured",
      quoteSource: null,
      quotePrice: null,
    });
    const refreshed = await refreshInvestmentQuote(manual, {
      quoteProvider: async () => {
        providerCalled = true;
        return 100;
      },
      store: controlled.store,
      now: () => now,
    });

    assert.equal(providerCalled, false);
    assert.deepEqual(refreshed, manual);
    assert.deepEqual(controlled.calls, []);
  });
});