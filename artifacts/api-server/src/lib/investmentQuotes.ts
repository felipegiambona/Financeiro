import type { StoredInvestment } from "@workspace/db";

export const QUOTE_SOURCE = "BRAPI";
export const QUOTE_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

export type QuoteProvider = (ticker: string) => Promise<number>;

export interface InvestmentQuoteStore {
  markUnavailable(row: StoredInvestment): Promise<StoredInvestment | undefined>;
  markUpdated(
    row: StoredInvestment,
    quotePrice: number,
    quoteAt: Date,
  ): Promise<StoredInvestment | undefined>;
  markError(row: StoredInvestment): Promise<StoredInvestment | undefined>;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isValidQuote(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function quoteIsFresh(
  row: StoredInvestment,
  now = new Date(),
): boolean {
  return row.quoteStatus === "updated"
    && row.lastQuoteAt !== null
    && now.getTime() - row.lastQuoteAt.getTime() < QUOTE_REFRESH_INTERVAL_MS;
}

export async function fetchBrapiQuote(ticker: string): Promise<number> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(`https://brapi.dev/api/quote/${encodeURIComponent(ticker)}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Quote provider returned ${response.status}`);
    const payload: unknown = await response.json();
    if (
      !payload
      || typeof payload !== "object"
      || !("results" in payload)
      || !Array.isArray(payload.results)
      || payload.results.length === 0
    ) {
      throw new Error("Quote provider returned no results");
    }
    const result = payload.results[0];
    const quote = result && typeof result === "object" && "regularMarketPrice" in result
      ? result.regularMarketPrice
      : undefined;
    if (!isValidQuote(quote)) {
      throw new Error("Quote provider returned an invalid price");
    }
    return quote;
  } finally {
    clearTimeout(timeout);
  }
}

export async function refreshInvestmentQuote(
  row: StoredInvestment,
  options: {
    quoteProvider?: QuoteProvider;
    store: InvestmentQuoteStore;
    now?: () => Date;
  },
): Promise<StoredInvestment> {
  const now = options.now ?? (() => new Date());
  if (row.valuationMode !== "automatic" || quoteIsFresh(row, now())) {
    return row;
  }

  if (!row.ticker) {
    return await options.store.markUnavailable(row) ?? row;
  }

  try {
    const quoteProvider = options.quoteProvider ?? fetchBrapiQuote;
    const quotePrice = await quoteProvider(row.ticker);
    if (!isValidQuote(quotePrice)) {
      throw new Error("Quote provider returned an invalid price");
    }
    const updated = await options.store.markUpdated(row, quotePrice, now());
    return updated ?? row;
  } catch {
    const updated = await options.store.markError(row);
    return updated ?? row;
  }
}

export function currentValueFromQuote(
  quotePrice: number,
  quantity: string | number,
): number {
  return roundMoney(quotePrice * Number(quantity));
}