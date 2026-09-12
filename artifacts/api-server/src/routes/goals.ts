import { and, asc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, goalsTable, transactionsTable } from "@workspace/db";
import {
  CreateGoalBody,
  CreateGoalResponse,
  DeleteGoalParams,
  ListGoalsResponse,
  UpdateGoalBody,
  UpdateGoalParams,
  UpdateGoalResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();
router.use("/goals", requireAuth);

function userIdFrom(req: unknown): string {
  return (req as AuthenticatedRequest).userId;
}

function toResponse(row: typeof goalsTable.$inferSelect, savedAmount: number) {
  return {
    ...row,
    targetAmount: Number(row.targetAmount),
    savedAmount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getSavedAmounts(userId: string, goalIds: string[]): Promise<Map<string, number>> {
  if (goalIds.length === 0) return new Map();
  const rows = await db.select({
    goalId: transactionsTable.goalId,
    type: transactionsTable.type,
    amount: transactionsTable.amount,
    paymentStatus: transactionsTable.paymentStatus,
  }).from(transactionsTable).where(and(
    eq(transactionsTable.userId, userId),
    inArray(transactionsTable.goalId, goalIds),
  ));
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!row.goalId || row.paymentStatus !== "paid") continue;
    const amount = Number(row.amount);
    const savedAmount = row.type === "expense" ? amount : 0;
    totals.set(row.goalId, (totals.get(row.goalId) ?? 0) + savedAmount);
  }
  return totals;
}

async function listForUser(userId: string) {
  const rows = await db.select().from(goalsTable)
    .where(eq(goalsTable.userId, userId))
    .orderBy(asc(goalsTable.createdAt));
  const savedAmounts = await getSavedAmounts(userId, rows.map((row) => row.id));
  return rows.map((row) => toResponse(row, Math.max(savedAmounts.get(row.id) ?? 0, 0)));
}

router.get("/goals", async (req, res): Promise<void> => {
  res.json(ListGoalsResponse.parse(await listForUser(userIdFrom(req))));
});

router.post("/goals", async (req, res): Promise<void> => {
  const parsed = CreateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(goalsTable).values({
    userId: userIdFrom(req),
    title: parsed.data.title.trim(),
    targetAmount: String(parsed.data.targetAmount),
    imageData: parsed.data.imageData ?? null,
    deadline: parsed.data.deadline ?? null,
  }).returning();
  res.status(201).json(CreateGoalResponse.parse(toResponse(row, 0)));
});

router.patch("/goals/:id", async (req, res): Promise<void> => {
  const params = UpdateGoalParams.safeParse(req.params);
  const body = UpdateGoalBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid goal update" });
    return;
  }
  const userId = userIdFrom(req);
  const updates = {
    ...(body.data.title === undefined ? {} : { title: body.data.title.trim() }),
    ...(body.data.targetAmount === undefined ? {} : { targetAmount: String(body.data.targetAmount) }),
    ...(body.data.imageData === undefined ? {} : { imageData: body.data.imageData }),
    ...(body.data.deadline === undefined ? {} : { deadline: body.data.deadline }),
  };
  const [row] = await db.update(goalsTable).set(updates)
    .where(and(eq(goalsTable.id, params.data.id), eq(goalsTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  const savedAmounts = await getSavedAmounts(userId, [row.id]);
  res.json(UpdateGoalResponse.parse(toResponse(row, Math.max(savedAmounts.get(row.id) ?? 0, 0))));
});

router.delete("/goals/:id", async (req, res): Promise<void> => {
  const params = DeleteGoalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid goal id" });
    return;
  }
  const userId = userIdFrom(req);
  await db.update(transactionsTable)
    .set({ goalId: null })
    .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.goalId, params.data.id)));
  const [row] = await db.delete(goalsTable)
    .where(and(eq(goalsTable.id, params.data.id), eq(goalsTable.userId, userId)))
    .returning({ id: goalsTable.id });
  if (!row) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;