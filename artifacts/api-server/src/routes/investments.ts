import { and, asc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateInvestmentBody,
  CreateInvestmentResponse,
  CreateInvestmentFavoriteBody,
  CreateInvestmentFavoriteResponse,
  DeleteInvestmentParams,
  DeleteInvestmentFavoriteParams,
  ListInvestmentsResponse,
  ListInvestmentFavoritesResponse,
  SearchInvestmentsResponse,
  UpdateInvestmentBody,
  UpdateInvestmentParams,
  UpdateInvestmentResponse,
} from "@workspace/api-zod";
import { db, investmentFavoritesTable, investmentsTable } from "@workspace/db";
import {
  financialProfileTypeFrom,
  profileIdFrom,
  requireAuth,
  resolveFinancialProfile,
  scopedUserIdFrom,
} from "../middlewares/requireAuth";
import {
  currentValueFromQuote,
  normalizeQuoteIdentifier,
  quoteIdentifierError,
  quoteSourceForAssetType,
  refreshInvestmentQuote,
  type InvestmentQuoteStore,
} from "../lib/investmentQuotes";
import { searchInvestmentCatalog } from "../lib/investmentCatalog";

const router: IRouter = Router();
router.use("/investments", requireAuth, resolveFinancialProfile);

function assertPersonalProfile(req: Request, res: Response): boolean {
  if (financialProfileTypeFrom(req) !== "personal") {
    res.status(403).json({ error: "Investments are only available for personal profiles" });
    return false;
  }
  return true;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toResponse(row: typeof investmentsTable.$inferSelect) {
  const investedAmount = Number(row.investedAmount);
  const currentValue = Number(row.currentValue);
  const manualCurrentValue = row.valuationMode === "manual" && Number(row.manualCurrentValue) === 0 && currentValue > 0
    ? currentValue
    : Number(row.manualCurrentValue);
  const returnAmount = roundMoney(currentValue - investedAmount);
  const returnPercentage = investedAmount > 0
    ? roundMoney((returnAmount / investedAmount) * 100)
    : 0;

  return {
    id: row.id,
    name: row.name,
    ticker: row.ticker,
    assetType: row.assetType,
    institution: row.institution,
    quantity: Number(row.quantity),
    averagePrice: Number(row.averagePrice),
    investedAmount,
    currentValue,
    manualCurrentValue,
    valuationMode: row.valuationMode,
    quoteSource: row.quoteSource,
    quotePrice: row.quotePrice === null ? null : Number(row.quotePrice),
    quoteStatus: row.quoteStatus,
    quoteError: row.quoteError,
    lastQuoteAt: row.lastQuoteAt?.toISOString() ?? null,
    isFavorite: row.isFavorite,
    returnAmount,
    returnPercentage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toFavoriteResponse(row: typeof investmentFavoritesTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    ticker: row.ticker,
    assetType: row.assetType,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const quoteStore: InvestmentQuoteStore = {
  async markUnavailable(row, quoteError) {
    const [updated] = await db.update(investmentsTable).set({
      quoteSource: quoteSourceForAssetType(row.assetType),
      quoteStatus: "unavailable",
      quoteError: quoteError ?? "Não há uma cotação disponível para este identificador.",
    }).where(and(
      eq(investmentsTable.id, row.id),
      eq(investmentsTable.userId, row.userId),
      eq(investmentsTable.profileId, row.profileId),
    )).returning();
    return updated;
  },
  async markUpdated(row, quotePrice, quoteAt) {
    const currentValue = currentValueFromQuote(quotePrice, row.quantity);
    const [updated] = await db.update(investmentsTable).set({
      currentValue: String(currentValue),
      quoteSource: quoteSourceForAssetType(row.assetType),
      quotePrice: String(quotePrice),
      quoteStatus: "updated",
      quoteError: null,
      lastQuoteAt: quoteAt,
    }).where(and(
      eq(investmentsTable.id, row.id),
      eq(investmentsTable.userId, row.userId),
      eq(investmentsTable.profileId, row.profileId),
    )).returning();
    return updated;
  },
  async markError(row) {
    const [updated] = await db.update(investmentsTable).set({
      quoteSource: quoteSourceForAssetType(row.assetType),
      quoteStatus: "error",
      quoteError: "Não foi possível obter a cotação agora. O último valor foi mantido.",
    }).where(and(
      eq(investmentsTable.id, row.id),
      eq(investmentsTable.userId, row.userId),
      eq(investmentsTable.profileId, row.profileId),
    )).returning();
    return updated;
  },
};

async function refreshQuote(row: typeof investmentsTable.$inferSelect) {
  return refreshInvestmentQuote(row, { store: quoteStore });
}

function optionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

router.get("/investments", async (req, res): Promise<void> => {
  if (!assertPersonalProfile(req, res)) return;
  const rows = await db.select().from(investmentsTable)
    .where(and(
      eq(investmentsTable.userId, scopedUserIdFrom(req)),
      eq(investmentsTable.profileId, profileIdFrom(req)),
    ))
    .orderBy(asc(investmentsTable.createdAt));
  res.json(ListInvestmentsResponse.parse(rows.map(toResponse)));
});

router.get("/investments/favorites", async (req, res): Promise<void> => {
  if (!assertPersonalProfile(req, res)) return;
  const rows = await db.select().from(investmentFavoritesTable)
    .where(and(
      eq(investmentFavoritesTable.userId, scopedUserIdFrom(req)),
      eq(investmentFavoritesTable.profileId, profileIdFrom(req)),
    ))
    .orderBy(asc(investmentFavoritesTable.createdAt));
  res.json(ListInvestmentFavoritesResponse.parse(rows.map(toFavoriteResponse)));
});

router.post("/investments/favorites", async (req, res): Promise<void> => {
  if (!assertPersonalProfile(req, res)) return;
  const parsed = CreateInvestmentFavoriteBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.name.trim()) {
    res.status(400).json({ error: parsed.success ? "Investment favorite name is required" : parsed.error.message });
    return;
  }

  const ticker = normalizeQuoteIdentifier(parsed.data.assetType, parsed.data.ticker.trim());
  const existing = await db.select().from(investmentFavoritesTable).where(and(
    eq(investmentFavoritesTable.userId, scopedUserIdFrom(req)),
    eq(investmentFavoritesTable.profileId, profileIdFrom(req)),
    eq(investmentFavoritesTable.name, parsed.data.name.trim()),
    eq(investmentFavoritesTable.ticker, ticker),
    eq(investmentFavoritesTable.assetType, parsed.data.assetType),
  ));
  if (existing[0]) {
    res.json(CreateInvestmentFavoriteResponse.parse(toFavoriteResponse(existing[0])));
    return;
  }

  const [row] = await db.insert(investmentFavoritesTable).values({
    userId: scopedUserIdFrom(req),
    profileId: profileIdFrom(req),
    name: parsed.data.name.trim(),
    ticker,
    assetType: parsed.data.assetType,
  }).returning();
  res.status(201).json(CreateInvestmentFavoriteResponse.parse(toFavoriteResponse(row)));
});

router.delete("/investments/favorites/:id", async (req, res): Promise<void> => {
  if (!assertPersonalProfile(req, res)) return;
  const params = DeleteInvestmentFavoriteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid investment favorite id" });
    return;
  }
  const [row] = await db.delete(investmentFavoritesTable).where(and(
    eq(investmentFavoritesTable.id, params.data.id),
    eq(investmentFavoritesTable.userId, scopedUserIdFrom(req)),
    eq(investmentFavoritesTable.profileId, profileIdFrom(req)),
  )).returning({ id: investmentFavoritesTable.id });
  if (!row) {
    res.status(404).json({ error: "Investment favorite not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/investments/search", async (req, res): Promise<void> => {
  if (!assertPersonalProfile(req, res)) return;
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (query.length < 2 || query.length > 40) {
    res.status(400).json({ error: "Search query must have between 2 and 40 characters" });
    return;
  }

  try {
    res.json(SearchInvestmentsResponse.parse(await searchInvestmentCatalog(query)));
  } catch {
    res.status(502).json({ error: "Investment catalog is temporarily unavailable" });
  }
});

router.post("/investments/refresh", async (req, res): Promise<void> => {
  if (!assertPersonalProfile(req, res)) return;
  const rows = await db.select().from(investmentsTable)
    .where(and(
      eq(investmentsTable.userId, scopedUserIdFrom(req)),
      eq(investmentsTable.profileId, profileIdFrom(req)),
      eq(investmentsTable.valuationMode, "automatic"),
    ))
    .orderBy(asc(investmentsTable.createdAt));
  const refreshed = await Promise.all(rows.map(refreshQuote));
  const refreshedById = new Map(refreshed.map((row) => [row.id, row]));
  const allRows = await db.select().from(investmentsTable)
    .where(and(
      eq(investmentsTable.userId, scopedUserIdFrom(req)),
      eq(investmentsTable.profileId, profileIdFrom(req)),
    ))
    .orderBy(asc(investmentsTable.createdAt));
  res.json(ListInvestmentsResponse.parse(allRows.map((row) => toResponse(refreshedById.get(row.id) ?? row))));
});

router.post("/investments", async (req, res): Promise<void> => {
  if (!assertPersonalProfile(req, res)) return;
  const parsed = CreateInvestmentBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.name.trim()) {
    res.status(400).json({ error: parsed.success ? "Investment name is required" : parsed.error.message });
    return;
  }

  const valuationMode = parsed.data.valuationMode ?? "manual";
  const ticker = normalizeQuoteIdentifier(parsed.data.assetType, optionalText(parsed.data.ticker) ?? "");
  if (valuationMode === "automatic" && ticker) {
    const quoteError = quoteIdentifierError(parsed.data.assetType, ticker);
    if (quoteError) {
      res.status(400).json({ error: quoteError });
      return;
    }
  }
  const [row] = await db.insert(investmentsTable).values({
    userId: scopedUserIdFrom(req),
    profileId: profileIdFrom(req),
    name: parsed.data.name.trim(),
    ticker: ticker || null,
    assetType: parsed.data.assetType,
    institution: optionalText(parsed.data.institution),
    quantity: String(parsed.data.quantity),
    averagePrice: String(parsed.data.averagePrice),
    investedAmount: String(parsed.data.investedAmount),
    currentValue: String(parsed.data.currentValue),
    manualCurrentValue: String(parsed.data.currentValue),
    valuationMode,
    quoteSource: valuationMode === "automatic" ? quoteSourceForAssetType(parsed.data.assetType) : null,
    quoteStatus: valuationMode === "automatic" ? "pending" : "not_configured",
    isFavorite: parsed.data.isFavorite ?? false,
  }).returning();
  res.status(201).json(CreateInvestmentResponse.parse(toResponse(row)));
});

router.patch("/investments/:id", async (req, res): Promise<void> => {
  if (!assertPersonalProfile(req, res)) return;
  const body = UpdateInvestmentBody.safeParse(req.body);
  const params = UpdateInvestmentParams.safeParse(req.params);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid investment update" });
    return;
  }
  if (body.data.name !== undefined && !body.data.name.trim()) {
    res.status(400).json({ error: "Investment name is required" });
    return;
  }

  const [existing] = await db.select().from(investmentsTable).where(and(
    eq(investmentsTable.id, params.data.id),
    eq(investmentsTable.userId, scopedUserIdFrom(req)),
    eq(investmentsTable.profileId, profileIdFrom(req)),
  ));
  if (!existing) {
    res.status(404).json({ error: "Investment not found" });
    return;
  }
  const valuationMode = body.data.valuationMode ?? existing.valuationMode;
  const assetType = body.data.assetType ?? existing.assetType;
  const ticker = body.data.ticker === undefined
    ? existing.ticker
    : normalizeQuoteIdentifier(assetType, optionalText(body.data.ticker) ?? "");
  if (valuationMode === "automatic" && ticker) {
    const quoteError = quoteIdentifierError(assetType, ticker);
    if (quoteError) {
      res.status(400).json({ error: quoteError });
      return;
    }
  }
  const existingManualCurrentValue = existing.valuationMode === "manual"
    && Number(existing.manualCurrentValue) === 0
    && Number(existing.currentValue) > 0
    ? Number(existing.currentValue)
    : Number(existing.manualCurrentValue);
  const manualCurrentValue = body.data.currentValue ?? existingManualCurrentValue;
  const switchedToAutomatic = valuationMode === "automatic" && existing.valuationMode !== "automatic";
  const requiresNewQuote = valuationMode === "automatic" && (
    switchedToAutomatic
    || body.data.ticker !== undefined
    || body.data.assetType !== undefined
    || body.data.quantity !== undefined
  );
  const updates = {
    ...(body.data.name === undefined ? {} : { name: body.data.name.trim() }),
    ...(body.data.ticker === undefined ? {} : { ticker: ticker || null }),
    ...(body.data.assetType === undefined ? {} : { assetType }),
    ...(body.data.institution === undefined ? {} : { institution: optionalText(body.data.institution) }),
    ...(body.data.quantity === undefined ? {} : { quantity: String(body.data.quantity) }),
    ...(body.data.averagePrice === undefined ? {} : { averagePrice: String(body.data.averagePrice) }),
    ...(body.data.investedAmount === undefined ? {} : { investedAmount: String(body.data.investedAmount) }),
    ...(body.data.currentValue === undefined ? {} : { manualCurrentValue: String(body.data.currentValue) }),
    ...(body.data.isFavorite === undefined ? {} : { isFavorite: body.data.isFavorite }),
    ...(valuationMode === "manual" ? { currentValue: String(manualCurrentValue) } : {}),
    valuationMode,
    ...(valuationMode === "manual" ? {
      quoteStatus: "not_configured" as const,
      quoteSource: null,
      quotePrice: null,
      quoteError: null,
      lastQuoteAt: null,
    } : {}),
    ...(requiresNewQuote ? {
      quoteStatus: "pending" as const,
      quoteSource: quoteSourceForAssetType(assetType),
      quotePrice: null,
      quoteError: null,
      lastQuoteAt: null,
    } : {}),
  };
  const [row] = await db.update(investmentsTable).set(updates).where(and(
    eq(investmentsTable.id, params.data.id),
    eq(investmentsTable.userId, scopedUserIdFrom(req)),
    eq(investmentsTable.profileId, profileIdFrom(req)),
  )).returning();
  res.json(UpdateInvestmentResponse.parse(toResponse(row)));
});

router.delete("/investments/:id", async (req, res): Promise<void> => {
  if (!assertPersonalProfile(req, res)) return;
  const params = DeleteInvestmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid investment id" });
    return;
  }
  const [row] = await db.delete(investmentsTable).where(and(
    eq(investmentsTable.id, params.data.id),
    eq(investmentsTable.userId, scopedUserIdFrom(req)),
    eq(investmentsTable.profileId, profileIdFrom(req)),
  )).returning({ id: investmentsTable.id });
  if (!row) {
    res.status(404).json({ error: "Investment not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
