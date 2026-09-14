const CATALOG_SOURCE = "https://brapi.dev/api/quote/list";
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_RESULTS = 8;

export type InvestmentCatalogAssetType =
  | "stock"
  | "fii"
  | "etf"
  | "fund"
  | "fixed_income"
  | "crypto"
  | "other";

export interface InvestmentCatalogResult {
  name: string;
  ticker: string;
  assetType: InvestmentCatalogAssetType;
}

type BrapiAsset = {
  stock?: unknown;
  name?: unknown;
  type?: unknown;
  subType?: unknown;
};

type BrapiSearchResponse = {
  stocks?: unknown;
};

const cache = new Map<string, { expiresAt: number; results: InvestmentCatalogResult[] }>();

function normalizeQuery(query: string): string {
  return query.trim().toLocaleUpperCase("pt-BR");
}

function mapAssetType(asset: BrapiAsset): InvestmentCatalogAssetType {
  const subType = typeof asset.subType === "string" ? asset.subType.toLowerCase() : "";
  const type = typeof asset.type === "string" ? asset.type.toLowerCase() : "";

  if (subType === "etf") return "etf";
  if (["fii", "fi-infra", "fi-agro", "fip", "fidc"].includes(subType)) return "fii";
  if (type === "stock") return "stock";
  if (type === "fund") return "fund";
  if (type === "bdr") return "other";
  return "other";
}

function parseResults(payload: unknown): InvestmentCatalogResult[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as BrapiSearchResponse).stocks)) {
    return [];
  }

  const unique = new Map<string, InvestmentCatalogResult>();
  for (const item of (payload as BrapiSearchResponse).stocks as BrapiAsset[]) {
    const ticker = typeof item?.stock === "string" ? item.stock.trim().toUpperCase() : "";
    if (!ticker || unique.has(ticker)) continue;
    const name = typeof item.name === "string" && item.name.trim() ? item.name.trim() : ticker;
    unique.set(ticker, { name, ticker, assetType: mapAssetType(item) });
    if (unique.size >= MAX_RESULTS) break;
  }
  return [...unique.values()];
}

export async function searchInvestmentCatalog(query: string): Promise<InvestmentCatalogResult[]> {
  const normalizedQuery = normalizeQuery(query);
  const cached = cache.get(normalizedQuery);
  if (cached && cached.expiresAt > Date.now()) return cached.results;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);
  try {
    const url = new URL(CATALOG_SOURCE);
    url.searchParams.set("search", normalizedQuery);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Investment catalog provider returned ${response.status}`);
    const results = parseResults(await response.json());
    cache.set(normalizedQuery, { expiresAt: Date.now() + CACHE_TTL_MS, results });
    return results;
  } finally {
    clearTimeout(timeout);
  }
}