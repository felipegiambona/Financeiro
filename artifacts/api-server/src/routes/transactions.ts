import { Router, type IRouter, type Response } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, transactionsTable } from "@workspace/db";
import {
  CreateTransactionBody,
  CreateTransactionResponse,
  DeleteTransactionParams,
  DeleteTransactionsBody,
  ListTransactionsResponse,
  UpdateTransactionBody,
  UpdateTransactionOccurrencePaymentStatusBody,
  UpdateTransactionParams,
  UpdateTransactionResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();
router.use("/transactions", requireAuth);

function toResponse(row: typeof transactionsTable.$inferSelect) {
  return {
    ...row,
    amount: Number(row.amount),
    recurrence: row.recurrence,
    paymentStatusOverrides: row.paymentStatusOverrides,
    createdAt: row.createdAt.toISOString(),
  };
}

function dateOnly(value: Date | string): string {
  return typeof value === "string" ? value : value.toISOString().slice(0, 10);
}

function serializeTransaction(
  row: typeof transactionsTable.$inferSelect,
  schema: typeof UpdateTransactionResponse | typeof CreateTransactionResponse,
) {
  const parsed = schema.parse(toResponse(row));
  return {
    ...parsed,
    date: dateOnly(parsed.date),
    dueDate: dateOnly(parsed.dueDate),
  };
}

function userIdFrom(req: unknown): string {
  return (req as AuthenticatedRequest).userId;
}

router.get("/transactions", async (req, res): Promise<void> => {
  const userId = userIdFrom(req);
  const rows = await db.select().from(transactionsTable)
    .where(eq(transactionsTable.userId, userId))
    .orderBy(desc(transactionsTable.date), desc(transactionsTable.createdAt));
  const parsed = ListTransactionsResponse.parse(rows.map(toResponse));
  res.json(parsed.map((transaction) => ({
    ...transaction,
    date: dateOnly(transaction.date),
    dueDate: dateOnly(transaction.dueDate),
  })));
});

router.post("/transactions", async (req, res): Promise<void> => {
  const parsed = CreateTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = userIdFrom(req);
  const [row] = await db.insert(transactionsTable).values({
    ...parsed.data,
    userId,
    amount: String(parsed.data.amount),
    date: dateOnly(parsed.data.date),
    dueDate: dateOnly(parsed.data.dueDate),
    paymentStatusOverrides: {},
  }).returning();
  res.status(201).json(serializeTransaction(row, CreateTransactionResponse));
});

router.patch("/transactions/:id", async (req, res): Promise<void> => {
  const params = UpdateTransactionParams.safeParse(req.params);
  const body = UpdateTransactionBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid transaction update" });
    return;
  }
  const userId = userIdFrom(req);
  const { amount, date, dueDate, ...otherUpdates } = body.data;
  const updates = {
    ...otherUpdates,
    ...(amount === undefined ? {} : { amount: String(amount) }),
    ...(date === undefined ? {} : { date: dateOnly(date) }),
    ...(dueDate === undefined ? {} : { dueDate: dateOnly(dueDate) }),
  };
  const [row] = await db.update(transactionsTable).set(updates)
    .where(and(eq(transactionsTable.id, params.data.id), eq(transactionsTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  res.json(serializeTransaction(row, UpdateTransactionResponse));
});

router.patch("/transactions/:id/occurrences/:occurrenceDate/payment-status", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawOccurrenceDate = Array.isArray(req.params.occurrenceDate)
    ? req.params.occurrenceDate[0]
    : req.params.occurrenceDate;
  const params = UpdateTransactionParams.safeParse({ id });
  const body = UpdateTransactionOccurrencePaymentStatusBody.safeParse(req.body);
  if (!params.success || !body.success || !/^\d{4}-\d{2}-\d{2}$/.test(rawOccurrenceDate ?? "")) {
    res.status(400).json({ error: "Invalid payment status update" });
    return;
  }
  const userId = userIdFrom(req);
  const occurrenceDate = rawOccurrenceDate;
  const [current] = await db.select().from(transactionsTable)
    .where(and(eq(transactionsTable.id, params.data.id), eq(transactionsTable.userId, userId)));
  if (!current) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  const overrides = (current.paymentStatusOverrides ?? {}) as Record<string, string>;
  const [row] = await db.update(transactionsTable)
    .set({ paymentStatusOverrides: { ...overrides, [occurrenceDate]: body.data.paymentStatus } })
    .where(and(eq(transactionsTable.id, params.data.id), eq(transactionsTable.userId, userId)))
    .returning();
  res.json(serializeTransaction(row, UpdateTransactionResponse));
});

router.delete("/transactions/:id", async (req, res): Promise<void> => {
  const params = DeleteTransactionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid transaction id" });
    return;
  }
  const userId = userIdFrom(req);
  const [row] = await db.delete(transactionsTable)
    .where(and(eq(transactionsTable.id, params.data.id), eq(transactionsTable.userId, userId)))
    .returning({ id: transactionsTable.id });
  if (!row) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/transactions/batch-delete", async (req, res): Promise<void> => {
  const body = DeleteTransactionsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid transaction ids" });
    return;
  }
  const userId = userIdFrom(req);
  await db.delete(transactionsTable)
    .where(and(eq(transactionsTable.userId, userId), inArray(transactionsTable.id, body.data.ids)));
  res.sendStatus(204);
});

router.delete("/transactions", async (req, res): Promise<void> => {
  const userId = userIdFrom(req);
  await db.delete(transactionsTable).where(eq(transactionsTable.userId, userId));
  res.sendStatus(204);
});

export default router;