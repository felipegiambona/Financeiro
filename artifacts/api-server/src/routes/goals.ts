import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, goalMovementsTable, goalsTable, transactionsTable } from "@workspace/db";
import {
  CreateGoalMovementBody,
  CreateGoalMovementParams,
  CreateGoalMovementResponse,
  CreateGoalBody,
  CreateGoalResponse,
  DeleteGoalParams,
  GetGoalParams,
  GetGoalResponse,
  ListGoalsResponse,
  UpdateGoalBody,
  UpdateGoalParams,
  UpdateGoalResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { ensureDefaultWallet } from "./wallets";

const router: IRouter = Router();
router.use("/goals", requireAuth);

function userIdFrom(req: unknown): string {
  return (req as AuthenticatedRequest).userId;
}

function dateOnly(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
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
  const movementRows = await db.select({
    goalId: goalMovementsTable.goalId,
    type: goalMovementsTable.type,
    amount: goalMovementsTable.amount,
  }).from(goalMovementsTable).where(and(
    eq(goalMovementsTable.userId, userId),
    inArray(goalMovementsTable.goalId, goalIds),
  ));
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!row.goalId || row.paymentStatus !== "paid") continue;
    const amount = Number(row.amount);
    const delta = row.type === "expense" ? amount : row.type === "income" ? -amount : 0;
    totals.set(row.goalId, (totals.get(row.goalId) ?? 0) + delta);
  }
  for (const row of movementRows) {
    const amount = Number(row.amount);
    const delta = row.type === "contribution" ? amount : -amount;
    totals.set(row.goalId, (totals.get(row.goalId) ?? 0) + delta);
  }
  return totals;
}

function toMovementResponse(row: typeof goalMovementsTable.$inferSelect) {
  return {
    ...row,
    amount: Number(row.amount),
    date: row.date.slice(0, 10),
    createdAt: row.createdAt.toISOString(),
  };
}

async function getGoalHistory(userId: string, goalId: string) {
  const transactions = await db.select().from(transactionsTable).where(and(
    eq(transactionsTable.userId, userId),
    eq(transactionsTable.goalId, goalId),
  ));
  const movements = await db.select().from(goalMovementsTable).where(and(
    eq(goalMovementsTable.userId, userId),
    eq(goalMovementsTable.goalId, goalId),
  ));
  return [
    ...transactions
      .filter((transaction) => transaction.type === "expense" || transaction.type === "income")
      .map((transaction) => ({
        id: transaction.id,
        type: transaction.type === "expense" ? "contribution" as const : "withdrawal" as const,
        amount: Number(transaction.amount),
        description: transaction.description,
        date: transaction.date.slice(0, 10),
        source: "transaction" as const,
        paymentStatus: transaction.paymentStatus as "paid" | "unpaid",
        transactionType: transaction.type as "income" | "expense",
        createdAt: transaction.createdAt.toISOString(),
      })),
    ...movements.map((movement) => ({
      id: movement.id,
      type: movement.type as "contribution" | "withdrawal",
      amount: Number(movement.amount),
      description: movement.description,
      date: movement.date.slice(0, 10),
      source: "manual" as const,
      paymentStatus: "paid" as const,
      transactionType: null,
      createdAt: movement.createdAt.toISOString(),
    })),
  ].sort((first, second) => (
    second.date.localeCompare(first.date) || second.createdAt.localeCompare(first.createdAt)
  ));
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
    deadline: dateOnly(parsed.data.deadline),
  }).returning();
  res.status(201).json(CreateGoalResponse.parse(toResponse(row, 0)));
});

router.get("/goals/:id", async (req, res): Promise<void> => {
  const params = GetGoalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid goal id" });
    return;
  }
  const userId = userIdFrom(req);
  const [row] = await db.select().from(goalsTable).where(and(
    eq(goalsTable.id, params.data.id),
    eq(goalsTable.userId, userId),
  ));
  if (!row) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  const savedAmount = Math.max((await getSavedAmounts(userId, [row.id])).get(row.id) ?? 0, 0);
  res.json(GetGoalResponse.parse({
    goal: toResponse(row, savedAmount),
    history: await getGoalHistory(userId, row.id),
  }));
});

router.post("/goals/:id/movements", async (req, res): Promise<void> => {
  const params = CreateGoalMovementParams.safeParse(req.params);
  const body = CreateGoalMovementBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid goal movement" });
    return;
  }
  const userId = userIdFrom(req);
  const [goal] = await db.select({ id: goalsTable.id }).from(goalsTable).where(and(
    eq(goalsTable.id, params.data.id),
    eq(goalsTable.userId, userId),
  ));
  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  if (body.data.type === "withdrawal") {
    const savedAmount = Math.max((await getSavedAmounts(userId, [goal.id])).get(goal.id) ?? 0, 0);
    if (body.data.amount > savedAmount) {
      res.status(400).json({ error: "Withdrawal exceeds saved amount" });
      return;
    }

    const wallet = await ensureDefaultWallet(userId);
    const description = body.data.description?.trim() || "Retirada da meta";
    const [transaction] = await db.insert(transactionsTable).values({
      userId,
      walletId: wallet.id,
      destinationWalletId: null,
      categoryId: null,
      goalId: goal.id,
      type: "income",
      amount: String(body.data.amount),
      description,
      date: dateOnly(body.data.date ?? new Date()) ?? new Date().toISOString().slice(0, 10),
      dueDate: null,
      recurrence: { kind: "none" },
      paymentStatus: "paid",
      paymentStatusOverrides: {},
    }).returning();

    res.status(201).json(CreateGoalMovementResponse.parse({
      id: transaction.id,
      goalId: goal.id,
      type: "withdrawal",
      amount: Number(transaction.amount),
      description: transaction.description,
      date: transaction.date,
      createdAt: transaction.createdAt.toISOString(),
    }));
    return;
  }

  const [row] = await db.insert(goalMovementsTable).values({
    userId,
    goalId: goal.id,
    type: body.data.type,
    amount: String(body.data.amount),
    description: body.data.description?.trim() || (body.data.type === "contribution" ? "Inclusão manual" : "Retirada manual"),
    date: dateOnly(body.data.date ?? new Date()) ?? new Date().toISOString().slice(0, 10),
  }).returning();
  res.status(201).json(CreateGoalMovementResponse.parse(toMovementResponse(row)));
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
    ...(body.data.deadline === undefined ? {} : { deadline: dateOnly(body.data.deadline) }),
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
  await db.delete(goalMovementsTable)
    .where(and(eq(goalMovementsTable.userId, userId), eq(goalMovementsTable.goalId, params.data.id)));
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