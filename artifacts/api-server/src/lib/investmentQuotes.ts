import type { StoredInvestment } from "@workspace/db";

export const QUOTE_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

export type SupportedQuoteAssetType = Exclude<StoredInvestment["assetType"], "other">;
export type QuoteSource = "BRAPI" | "CVM" | "BCB_SGS" | "COINGECKO";

export type QuoteConfiguration = {
  source: QuoteSource;
  identifierLabel: string;
  identifierHint: string;
  example: string;
};

const QUOTE_CONFIGURATIONS: Record<SupportedQuoteAssetType, QuoteConfiguration> = {
  stock: {
    source: "BRAPI",
    identifierLabel: "Ticker B3",
    identifierHint: "Use o ticker oficial da B3, sem espaços.",
    example: "PETR4",
  },
  fii: {
    source: "BRAPI",
    identifierLabel: "Ticker B3",
    identifierHint: "Use o ticker oficial do fundo imobiliário, sem espaços.",
    example: "HGLG11",
  },
  etf: {
    source: "BRAPI",
    identifierLabel: "Ticker B3",
    identifierHint: "Use o ticker oficial do ETF, sem espaços.",
    example: "BOVA11",
  },
  fund: {
    source: "CVM",
    identifierLabel: "CNPJ do fundo",
    identifierHint: "Use os 14 dígitos do CNPJ do fundo, sem pontuação.",
    example: "00.000.000/0001-00",
  },
  fixed_income: {
    source: "BCB_SGS",
    identifierLabel: "Código da série BCB SGS",
    identifierHint: "Use o código numérico da série SGS do Banco Central.",
    example: "1178",
  },
  crypto: {
    source: "COINGECKO",
    identifierLabel: "ID do CoinGecko",
    identifierHint: "Use o ID único do ativo no CoinGecko, não o símbolo.",
    example: "bitcoin",
  },
};
const AMBIGUOUS_CRYPTO_IDENTIFIERS = new Set([
  "ada",
  "avax",
  "bnb",
  "btc",
  "doge",
  "dot",
  "eth",
  "link",
  "sol",
  "usdc",
  "usdt",
  "xrp",
]);

export function quoteConfigurationForAssetType(
  assetType: StoredInvestment["assetType"],
): QuoteConfiguration | null {
  return assetType === "other" ? null : QUOTE_CONFIGURATIONS[assetType];
}

export function quoteSourceForAssetType(
  assetType: StoredInvestment["assetType"],
): QuoteSource | null {
  return quoteConfigurationForAssetType(assetType)?.source ?? null;
}

export function normalizeQuoteIdentifier(
  assetType: StoredInvestment["assetType"],
  identifier: string,
): string {
  const trimmed = identifier.trim();
  if (assetType === "stock" || assetType === "fii" || assetType === "etf") {
    return trimmed.toUpperCase();
  }
  if (assetType === "fund") {
    return trimmed.replace(/[.\-/\s]/g, "");
  }
  if (assetType === "crypto") {
    return trimmed.toLowerCase();
  }
  return trimmed;
}

export function quoteIdentifierError(
  assetType: StoredInvestment["assetType"],
  identifier: string | null | undefined,
): string | null {
  const configuration = quoteConfigurationForAssetType(assetType);
  if (!configuration) {
    return "Esta classe de ativo não possui uma fonte de cotação automática.";
  }
  if (!identifier?.trim()) {
    return `Informe ${configuration.identifierLabel} para consultar a cotação.`;
  }

  const normalized = normalizeQuoteIdentifier(assetType, identifier);
  const valid = assetType === "fund"
    ? /^\d{14}$/.test(normalized)
    : assetType === "fixed_income"
      ? /^\d{1,6}$/.test(normalized)
      : assetType === "crypto"
        ? /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)
          && !AMBIGUOUS_CRYPTO_IDENTIFIERS.has(normalized)
        : /^[A-Z][A-Z0-9]{2,6}\d{1,2}$/.test(normalized);
  if (!valid) {
    return `Use ${configuration.identifierLabel} no formato esperado (ex.: ${configuration.example}).`;
  }
  return null;
}

export type QuoteProvider = (
  identifier: string,
  assetType?: StoredInvestment["assetType"],
) => Promise<number>;

export interface InvestmentQuoteStore {
  markUnavailable(
    row: StoredInvestment,
    quoteError?: string,
  ): Promise<StoredInvestment | undefined>;
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

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Quote provider returned ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
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
  const payload = await fetchJson(`https://brapi.dev/api/quote/${encodeURIComponent(ticker)}`);
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
}

export async function fetchCoinGeckoQuote(identifier: string): Promise<number> {
  const payload = await fetchJson(
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(identifier)}&vs_currencies=brl`,
  );
  const result = payload && typeof payload === "object" && identifier in payload
    ? (payload as Record<string, unknown>)[identifier]
    : undefined;
  const quote = result && typeof result === "object" && "brl" in result ? result.brl : undefined;
  if (!isValidQuote(quote)) {
    throw new Error("CoinGecko returned no BRL price for this asset");
  }
  return quote;
}

export async function fetchBcbSgsQuote(seriesCode: string): Promise<number> {
  const payload = await fetchJson(
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${encodeURIComponent(seriesCode)}/dados/ultimos/1?formato=json`,
  );
  const latest = Array.isArray(payload) ? payload[0] : undefined;
  const rawQuote = latest && typeof latest === "object" && "valor" in latest ? latest.valor : undefined;
  const quote = typeof rawQuote === "string" ? Number(rawQuote.replace(",", ".")) : rawQuote;
  if (!isValidQuote(quote)) {
    throw new Error("BCB SGS returned an invalid series value");
  }
  return quote;
}

const cvmMonthlyFiles = new Map<string, Promise<string>>();

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function fetchCvmMonthlyFile(key: string): Promise<string> {
  const existing = cvmMonthlyFiles.get(key);
  if (existing) return existing;
  const request = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(
        `https://dados.cvm.gov.br/dados/FI/DOC/INF_DIARIO/DADOS/inf_diario_fi_${key}.csv`,
        { signal: controller.signal, headers: { Accept: "text/csv" } },
      );
      if (!response.ok) throw new Error(`CVM returned ${response.status}`);
      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  })();
  cvmMonthlyFiles.set(key, request);
  try {
    return await request;
  } catch (error) {
    cvmMonthlyFiles.delete(key);
    throw error;
  }
}

function cvmQuoteFromCsv(csv: string, cnpj: string): number | null {
  const normalizedCnpj = normalizeQuoteIdentifier("fund", cnpj);
  const rows = csv.split(/\r?\n/);
  let latest: { date: string; quote: number } | null = null;
  for (const row of rows.slice(1)) {
    const columns = row.split(";");
    if (normalizeQuoteIdentifier("fund", columns[1] ?? "") !== normalizedCnpj) continue;
    const quote = Number((columns[4] ?? "").replace(",", "."));
    if (!isValidQuote(quote)) continue;
    const date = columns[2] ?? "";
    if (!latest || date > latest.date) latest = { date, quote };
  }
  return latest?.quote ?? null;
}

export async function fetchCvmFundQuote(cnpj: string): Promise<number> {
  const now = new Date();
  let lastError: unknown;
  for (let offset = 0; offset < 2; offset += 1) {
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    try {
      const quote = cvmQuoteFromCsv(await fetchCvmMonthlyFile(monthKey(month)), cnpj);
      if (quote !== null) return quote;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  throw new Error("CVM returned no quote for this fund CNPJ");
}

export function quoteProviderForAssetType(
  assetType: StoredInvestment["assetType"],
): QuoteProvider | null {
  switch (assetType) {
    case "stock":
    case "fii":
    case "etf":
      return fetchBrapiQuote;
    case "fund":
      return fetchCvmFundQuote;
    case "fixed_income":
      return fetchBcbSgsQuote;
    case "crypto":
      return fetchCoinGeckoQuote;
    default:
      return null;
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

  const identifierError = quoteIdentifierError(row.assetType, row.ticker);
  if (identifierError) {
    return await options.store.markUnavailable(row, identifierError) ?? row;
  }

  try {
    const quoteProvider = options.quoteProvider ?? quoteProviderForAssetType(row.assetType);
    if (!quoteProvider) {
      return await options.store.markUnavailable(
        row,
        "Esta classe de ativo não possui uma fonte de cotação automática.",
      ) ?? row;
    }
    const quotePrice = await quoteProvider(normalizeQuoteIdentifier(row.assetType, row.ticker!), row.assetType);
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