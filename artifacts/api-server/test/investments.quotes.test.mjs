import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { refreshInvestmentQuote } from "../src/lib/investmentQuotes.ts";

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
          quoteStatus: "error",
          quoteError: "Não foi possível obter a cotação agora. O último valor foi mantido.",
        };
      },
    },
  };
}

describe("investment quote refresh", () => {
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