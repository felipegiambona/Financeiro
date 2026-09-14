import { and, asc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateInvestmentBody,
  CreateInvestmentResponse,
  DeleteInvestmentParams,
  ListInvestmentsResponse,
  UpdateInvestmentBody,
  UpdateInvestmentParams,
  UpdateInvestmentResponse,
} from "@workspace/api-zod";
import { db, investmentsTable } from "@workspace/db";
import {
  financialProfileTypeFrom,
  profileIdFrom,
  requireAuth,
  resolveFinancialProfile,
  scopedUserIdFrom,
} from "../middlewares/requireAuth";

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
    returnAmount,
    returnPercentage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
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

router.post("/investments", async (req, res): Promise<void> => {
  if (!assertPersonalProfile(req, res)) return;
  const parsed = CreateInvestmentBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.name.trim()) {
    res.status(400).json({ error: parsed.success ? "Investment name is required" : parsed.error.message });
    return;
  }

  const [row] = await db.insert(investmentsTable).values({
    userId: scopedUserIdFrom(req),
    profileId: profileIdFrom(req),
    name: parsed.data.name.trim(),
    ticker: optionalText(parsed.data.ticker),
    assetType: parsed.data.assetType,
    institution: optionalText(parsed.data.institution),
    quantity: String(parsed.data.quantity),
    averagePrice: String(parsed.data.averagePrice),
    investedAmount: String(parsed.data.investedAmount),
    currentValue: String(parsed.data.currentValue),
  }).returning();
  res.status(201).json(CreateInvestmentResponse.parse(toResponse(row)));
});

router.patch("/investments/:id", async (req, res): Promise<void> => {
  if (!assertPersonalProfile(req, res)) return;
  const params = UpdateInvestmentParams.safeParse(req.params);
  const body = UpdateInvestmentBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid investment update" });
    return;
  }
  if (body.data.name !== undefined && !body.data.name.trim()) {
    res.status(400).json({ error: "Investment name is required" });
    return;
  }

  const updates = {
    ...(body.data.name === undefined ? {} : { name: body.data.name.trim() }),
    ...(body.data.ticker === undefined ? {} : { ticker: optionalText(body.data.ticker) }),
    ...(body.data.assetType === undefined ? {} : { assetType: body.data.assetType }),
    ...(body.data.institution === undefined ? {} : { institution: optionalText(body.data.institution) }),
    ...(body.data.quantity === undefined ? {} : { quantity: String(body.data.quantity) }),
    ...(body.data.averagePrice === undefined ? {} : { averagePrice: String(body.data.averagePrice) }),
    ...(body.data.investedAmount === undefined ? {} : { investedAmount: String(body.data.investedAmount) }),
    ...(body.data.currentValue === undefined ? {} : { currentValue: String(body.data.currentValue) }),
  };
  const [row] = await db.update(investmentsTable).set(updates).where(and(
    eq(investmentsTable.id, params.data.id),
    eq(investmentsTable.userId, scopedUserIdFrom(req)),
    eq(investmentsTable.profileId, profileIdFrom(req)),
  )).returning();
  if (!row) {
    res.status(404).json({ error: "Investment not found" });
    return;
  }
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