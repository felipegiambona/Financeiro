import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateInvestmentDividendBody,
  CreateInvestmentDividendResponse,
  DeleteInvestmentDividendParams,
  ListInvestmentDividendsResponse,
  UpdateInvestmentDividendBody,
  UpdateInvestmentDividendParams,
  UpdateInvestmentDividendResponse,
} from "@workspace/api-zod";
import {
  db,
  investmentDividendsTable,
  investmentsTable,
  transactionsTable,
  type StoredInvestmentDividend,
  type StoredInvestment,
} from "@workspace/db";
import {
  financialProfileTypeFrom,
  profileIdFrom,
  requireAuth,
  resolveFinancialProfile,
  scopedUserIdFrom,
} from "../middlewares/requireAuth";
import { dateKey } from "../services/cardInvoices";
import { getUserWallet } from "./wallets";

const router: IRouter = Router();
router.use("/investments/dividends", requireAuth, resolveFinancialProfile);

function assertPersonalProfile(req: Request, res: Response): boolean {
  if (financialProfileTypeFrom(req) !== "personal") {
    res.status(403).json({ error: "Investments are only available for personal profiles" });
    return false;
  }
  return true;
}

function dateOnlyInput(rawValue: unknown, parsedValue: Date | undefined): string | null {
  if (typeof rawValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawValue)) return rawValue;
  if (parsedValue) return dateKey(parsedValue);
  return null;
}

function optionalNote(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function responseFor(
  row: StoredInvestmentDividend,
  investment: Pick<StoredInvestment, "name" | "ticker">,
) {
  return {
    id: row.id,
    investmentId: row.investmentId,
    investmentName: investment.name,
    investmentTicker: investment.ticker,
    type: row.type,
    amount: Number(row.amount),
    paymentDate: `${row.paymentDate}T12:00:00-03:00`,
    status: row.status,
    note: row.note,
    transactionId: row.transactionId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeResponse(
  row: StoredInvestmentDividend,
  investment: Pick<StoredInvestment, "name" | "ticker">,
  schema: typeof CreateInvestmentDividendResponse | typeof UpdateInvestmentDividendResponse,
) {
  const parsed = schema.parse(responseFor(row, investment));
  return {
    ...parsed,
    paymentDate: dateKey(parsed.paymentDate),
  };
}

async function findInvestment(
  userId: string,
  profileId: string,
  investmentId: string,
) {
  const [investment] = await db.select().from(investmentsTable).where(and(
    eq(investmentsTable.id, investmentId),
    eq(investmentsTable.userId, userId),
    eq(investmentsTable.profileId, profileId),
  ));
  return investment ?? null;
}

async function findDividend(
  userId: string,
  profileId: string,
  dividendId: string,
) {
  const [row] = await db.select({
    dividend: investmentDividendsTable,
    investmentName: investmentsTable.name,
    investmentTicker: investmentsTable.ticker,
  }).from(investmentDividendsTable)
    .innerJoin(investmentsTable, eq(investmentsTable.id, investmentDividendsTable.investmentId))
    .where(and(
      eq(investmentDividendsTable.id, dividendId),
      eq(investmentDividendsTable.userId, userId),
      eq(investmentDividendsTable.profileId, profileId),
    ));
  return row
    ? {
        dividend: row.dividend,
        investment: { name: row.investmentName, ticker: row.investmentTicker },
      }
    : null;
}

async function ensureReceiptTransaction(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  dividend: StoredInvestmentDividend,
  investment: StoredInvestment,
  userId: string,
  profileId: string,
): Promise<string> {
  const wallet = await getUserWallet(userId, investment.walletId ?? undefined);
  if (!wallet) throw new Error("Wallet not found");
  const description = `${dividend.type === "jcp" ? "JCP" : "Dividendo"} · ${investment.name}`;
  const transactionValues = {
    walletId: wallet.id,
    profileId,
    cardId: null,
    cardEntryType: "purchase",
    destinationWalletId: null,
    categoryId: null,
    goalId: null,
    investmentId: investment.id,
    type: "income",
    isInvestment: false,
    amount: String(dividend.amount),
    description,
    date: dividend.paymentDate,
    dueDate: null,
    recurrence: { kind: "none" },
    paymentStatus: "paid",
    paymentStatusOverrides: {},
  } as const;

  if (dividend.transactionId) {
    const [updated] = await tx.update(transactionsTable).set(transactionValues).where(and(
      eq(transactionsTable.id, dividend.transactionId),
      eq(transactionsTable.userId, userId),
      eq(transactionsTable.profileId, profileId),
    )).returning({ id: transactionsTable.id });
    if (updated) return updated.id;
  }

  const [created] = await tx.insert(transactionsTable).values({
    ...transactionValues,
    userId,
  }).returning({ id: transactionsTable.id });
  return created.id;
}

router.get("/investments/dividends", async (req, res): Promise<void> => {
  if (!assertPersonalProfile(req, res)) return;
  const rows = await db.select({
    dividend: investmentDividendsTable,
    investmentName: investmentsTable.name,
    investmentTicker: investmentsTable.ticker,
  }).from(investmentDividendsTable)
    .innerJoin(investmentsTable, eq(investmentsTable.id, investmentDividendsTable.investmentId))
    .where(and(
      eq(investmentDividendsTable.userId, scopedUserIdFrom(req)),
      eq(investmentDividendsTable.profileId, profileIdFrom(req)),
    ))
    .orderBy(desc(investmentDividendsTable.paymentDate), desc(investmentDividendsTable.createdAt));
  res.json(ListInvestmentDividendsResponse.parse(rows.map(({ dividend, investmentName, investmentTicker }) => (
    responseFor(dividend, { name: investmentName, ticker: investmentTicker })
  ))).map((row) => ({
    ...row,
    paymentDate: dateKey(row.paymentDate),
  })));
});

router.post("/investments/dividends", async (req, res): Promise<void> => {
  if (!assertPersonalProfile(req, res)) return;
  const parsed = CreateInvestmentDividendBody.safeParse(req.body);
  const paymentDate = parsed.success
    ? dateOnlyInput(req.body?.paymentDate, parsed.data.paymentDate)
    : null;
  if (!parsed.success || !paymentDate) {
    res.status(400).json({ error: parsed.success ? "Invalid payment date" : parsed.error.message });
    return;
  }

  const userId = scopedUserIdFrom(req);
  const profileId = profileIdFrom(req);
  try {
    const result = await db.transaction(async (tx) => {
      const [investment] = await tx.select().from(investmentsTable).where(and(
        eq(investmentsTable.id, parsed.data.investmentId),
        eq(investmentsTable.userId, userId),
        eq(investmentsTable.profileId, profileId),
      ));
      if (!investment) return null;

      const [created] = await tx.insert(investmentDividendsTable).values({
        userId,
        profileId,
        investmentId: investment.id,
        type: parsed.data.type,
        amount: String(parsed.data.amount),
        paymentDate,
        status: parsed.data.status,
        note: optionalNote(parsed.data.note),
      }).returning();
      if (created.status === "received") {
        const transactionId = await ensureReceiptTransaction(tx, created, investment, userId, profileId);
        const [updated] = await tx.update(investmentDividendsTable)
          .set({ transactionId })
          .where(eq(investmentDividendsTable.id, created.id))
          .returning();
        return { dividend: updated, investment };
      }
      return { dividend: created, investment };
    });
    if (!result) {
      res.status(404).json({ error: "Investment not found" });
      return;
    }
    res.status(201).json(serializeResponse(result.dividend, result.investment, CreateInvestmentDividendResponse));
  } catch (error) {
    if (error instanceof Error && error.message === "Wallet not found") {
      res.status(400).json({ error: error.message });
      return;
    }
    throw error;
  }
});

router.patch("/investments/dividends/:id", async (req, res): Promise<void> => {
  if (!assertPersonalProfile(req, res)) return;
  const params = UpdateInvestmentDividendParams.safeParse(req.params);
  const parsed = UpdateInvestmentDividendBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid investment dividend update" });
    return;
  }

  const userId = scopedUserIdFrom(req);
  const profileId = profileIdFrom(req);
  const current = await findDividend(userId, profileId, params.data.id);
  if (!current) {
    res.status(404).json({ error: "Investment dividend not found" });
    return;
  }

  const paymentDate = parsed.data.paymentDate === undefined
    ? current.dividend.paymentDate
    : dateOnlyInput(req.body?.paymentDate, parsed.data.paymentDate);
  if (!paymentDate) {
    res.status(400).json({ error: "Invalid payment date" });
    return;
  }

  const investmentId = parsed.data.investmentId ?? current.dividend.investmentId;
  const investment = await findInvestment(userId, profileId, investmentId);
  if (!investment) {
    res.status(404).json({ error: "Investment not found" });
    return;
  }
  const status = parsed.data.status ?? current.dividend.status;

  try {
    const result = await db.transaction(async (tx) => {
      const transactionId = status === "received"
        ? await ensureReceiptTransaction(tx, {
            ...current.dividend,
            investmentId: investment.id,
            type: parsed.data.type ?? current.dividend.type,
            amount: String(parsed.data.amount ?? current.dividend.amount),
            paymentDate,
            status,
          }, investment, userId, profileId)
        : current.dividend.transactionId;
      const [updated] = await tx.update(investmentDividendsTable).set({
        investmentId: investment.id,
        type: parsed.data.type ?? current.dividend.type,
        amount: parsed.data.amount === undefined ? current.dividend.amount : String(parsed.data.amount),
        paymentDate,
        status,
        note: parsed.data.note === undefined ? current.dividend.note : optionalNote(parsed.data.note),
        transactionId,
      }).where(and(
        eq(investmentDividendsTable.id, params.data.id),
        eq(investmentDividendsTable.userId, userId),
        eq(investmentDividendsTable.profileId, profileId),
      )).returning();
      return updated ? { dividend: updated, investment } : null;
    });
    if (!result) {
      res.status(404).json({ error: "Investment dividend not found" });
      return;
    }
    res.json(serializeResponse(result.dividend, result.investment, UpdateInvestmentDividendResponse));
  } catch (error) {
    if (error instanceof Error && error.message === "Wallet not found") {
      res.status(400).json({ error: error.message });
      return;
    }
    throw error;
  }
});

router.delete("/investments/dividends/:id", async (req, res): Promise<void> => {
  if (!assertPersonalProfile(req, res)) return;
  const params = DeleteInvestmentDividendParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid investment dividend id" });
    return;
  }
  const userId = scopedUserIdFrom(req);
  const profileId = profileIdFrom(req);
  const [deleted] = await db.transaction(async (tx) => {
    const [current] = await tx.select({
      id: investmentDividendsTable.id,
      transactionId: investmentDividendsTable.transactionId,
    }).from(investmentDividendsTable).where(and(
      eq(investmentDividendsTable.id, params.data.id),
      eq(investmentDividendsTable.userId, userId),
      eq(investmentDividendsTable.profileId, profileId),
    ));
    if (!current) return [];
    if (current.transactionId) {
      await tx.update(transactionsTable).set({ investmentId: null }).where(and(
        eq(transactionsTable.id, current.transactionId),
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.profileId, profileId),
      ));
    }
    return tx.delete(investmentDividendsTable).where(and(
      eq(investmentDividendsTable.id, current.id),
      eq(investmentDividendsTable.userId, userId),
      eq(investmentDividendsTable.profileId, profileId),
    )).returning({ id: investmentDividendsTable.id });
  });
  if (!deleted) {
    res.status(404).json({ error: "Investment dividend not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;