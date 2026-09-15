import { Router, type IRouter, type Response } from "express";
import { and, desc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { cardsTable, categoriesTable, db, goalsTable, transactionsTable, walletsTable } from "@workspace/db";
import {
  CreateTransactionBody,
  CreateTransactionResponse,
  DeleteTransactionParams,
  DeleteTransactionsBody,
  ListTransactionsResponse,
  UpdateTransactionsBody,
  UpdateTransactionBody,
  UpdateTransactionOccurrencePaymentStatusBody,
  UpdateTransactionParams,
  UpdateTransactionResponse,
} from "@workspace/api-zod";
import { profileIdFrom, requireAuth, resolveFinancialProfile, scopedUserIdFrom } from "../middlewares/requireAuth";
import { dateKey, invoiceMonthForPurchase } from "../services/cardInvoices";
import { ensureDefaultWallet, getUserWallet } from "./wallets";

const router: IRouter = Router();
router.use("/transactions", requireAuth, resolveFinancialProfile);

function toResponse(row: typeof transactionsTable.$inferSelect) {
  return {
    ...row,
    amount: Number(row.amount),
    recurrence: row.recurrence,
    paymentStatusOverrides: row.paymentStatusOverrides,
    createdAt: row.createdAt.toISOString(),
  };
}

function dateOnly(value: Date | string): string;
function dateOnly(value: Date | string | null | undefined): string | null;
function dateOnly(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
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

const userIdFrom = scopedUserIdFrom;

router.get("/transactions", async (req, res): Promise<void> => {
  const userId = userIdFrom(req);
  const [defaultWallet] = await db.select({ id: walletsTable.id }).from(walletsTable)
    .where(and(eq(walletsTable.userId, userId), eq(walletsTable.isDefault, true)))
    .limit(1);
  if (defaultWallet) {
    await db.update(transactionsTable)
      .set({ walletId: defaultWallet.id })
      .where(and(eq(transactionsTable.userId, userId), isNull(transactionsTable.walletId)));
  }
  const rows = await db.select().from(transactionsTable)
    .where(and(
      eq(transactionsTable.userId, userId),
      or(
        isNull(transactionsTable.cardId),
        ne(transactionsTable.cardEntryType, "purchase"),
      ),
    ))
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
  const wallet = await getUserWallet(userId, parsed.data.walletId);
  const destinationWallet = parsed.data.type === "transfer"
    ? await getUserWallet(userId, parsed.data.destinationWalletId ?? undefined)
    : null;
  if (!wallet || (parsed.data.type === "transfer" && (!destinationWallet || destinationWallet.id === wallet.id))) {
    res.status(400).json({ error: "Wallet not found" });
    return;
  }
  if (parsed.data.categoryId) {
    const [category] = await db.select().from(categoriesTable)
      .where(and(eq(categoriesTable.id, parsed.data.categoryId), eq(categoriesTable.userId, userId)));
    if (!category) {
      res.status(400).json({ error: "Category not found" });
      return;
    }
  }
  if (parsed.data.goalId) {
    const [goal] = await db.select({ id: goalsTable.id }).from(goalsTable)
      .where(and(eq(goalsTable.id, parsed.data.goalId), eq(goalsTable.userId, userId)));
    if (!goal || (parsed.data.type !== "expense" && parsed.data.type !== "income")) {
      res.status(400).json({ error: "Invalid goal transaction" });
      return;
    }
  }
  let cardClosingDay: number | null = null;
  if (parsed.data.cardId) {
    if (parsed.data.type !== "expense") {
      res.status(400).json({ error: "Cards can only be linked to expenses" });
      return;
    }
    const [card] = await db.select({ id: cardsTable.id, closingDay: cardsTable.closingDay }).from(cardsTable)
      .where(and(eq(cardsTable.id, parsed.data.cardId), eq(cardsTable.userId, userId)));
    if (!card) {
      res.status(400).json({ error: "Card not found" });
      return;
    }
    cardClosingDay = card.closingDay;
  }
  const effectiveDate = dateOnly(parsed.data.date) ?? dateKey(new Date());
  const [row] = await db.insert(transactionsTable).values({
    ...parsed.data,
    userId,
    profileId: profileIdFrom(req),
    walletId: wallet.id,
    cardId: parsed.data.type === "expense" ? parsed.data.cardId ?? null : null,
    cardEntryType: "purchase",
    cardInvoiceMonth: parsed.data.cardId
      ? invoiceMonthForPurchase(effectiveDate, cardClosingDay ?? 31)
      : null,
    destinationWalletId: parsed.data.type === "transfer" ? destinationWallet?.id : null,
    categoryId: parsed.data.categoryId ?? null,
    goalId: parsed.data.goalId ?? null,
    isInvestment: parsed.data.isInvestment ?? false,
    amount: String(parsed.data.amount),
    date: effectiveDate,
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
  const defaultWallet = await ensureDefaultWallet(userId);
  await db.update(transactionsTable)
    .set({ walletId: defaultWallet.id })
    .where(and(eq(transactionsTable.userId, userId), isNull(transactionsTable.walletId)));
  const {
    amount,
    date,
    dueDate,
    walletId,
    destinationWalletId,
    categoryId,
    goalId,
    cardId,
    type,
    paymentStatus,
    ...otherUpdates
  } = body.data;
  const [current] = await db.select().from(transactionsTable)
    .where(and(eq(transactionsTable.id, params.data.id), eq(transactionsTable.userId, userId)));
  if (!current) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  const effectiveType = type ?? current.type;
  const effectiveWalletId = walletId ?? current.walletId ?? defaultWallet.id;
  const effectiveDestinationWalletId = destinationWalletId ?? current.destinationWalletId;
  const wallet = await getUserWallet(userId, effectiveWalletId);
  const destinationWallet = effectiveType === "transfer"
    ? await getUserWallet(userId, effectiveDestinationWalletId ?? undefined)
    : null;
  if (
    !wallet
    || (effectiveType === "transfer" && (!destinationWallet || destinationWallet.id === wallet.id))
  ) {
    res.status(400).json({ error: effectiveType === "transfer" ? "Invalid transfer wallets" : "Wallet not found" });
    return;
  }
  if (categoryId !== undefined) {
    const [category] = categoryId === null ? [] : await db.select().from(categoriesTable)
      .where(and(eq(categoriesTable.id, categoryId), eq(categoriesTable.userId, userId)));
    if (categoryId !== null && !category) {
      res.status(400).json({ error: "Category not found" });
      return;
    }
  }
  const effectiveCardId = effectiveType === "expense"
    ? cardId === undefined ? current.cardId : cardId
    : null;
  let effectiveCardClosingDay: number | null = null;
  if (effectiveCardId) {
    const [card] = await db.select({ id: cardsTable.id, closingDay: cardsTable.closingDay }).from(cardsTable)
      .where(and(eq(cardsTable.id, effectiveCardId), eq(cardsTable.userId, userId)));
    if (!card) {
      res.status(400).json({ error: "Card not found" });
      return;
    }
    effectiveCardClosingDay = card.closingDay;
  }
  const effectiveGoalId = goalId === undefined ? current.goalId : goalId;
  if (effectiveGoalId) {
    const [goal] = await db.select({ id: goalsTable.id }).from(goalsTable)
      .where(and(eq(goalsTable.id, effectiveGoalId), eq(goalsTable.userId, userId)));
    if (!goal || (effectiveType !== "expense" && effectiveType !== "income")) {
      res.status(400).json({ error: "Invalid goal transaction" });
      return;
    }
  }
  const updates = {
    ...otherUpdates,
    ...(amount === undefined ? {} : { amount: String(amount) }),
    ...(date === undefined ? {} : { date: dateOnly(date) }),
    ...(dueDate === undefined ? {} : { dueDate: dateOnly(dueDate) }),
    ...(walletId === undefined ? {} : { walletId: wallet.id }),
    ...((cardId !== undefined || type !== undefined || date !== undefined) ? {
      cardId: effectiveCardId,
      cardEntryType: current.cardEntryType === "invoice_payment"
        ? "invoice_payment"
        : "purchase",
      cardInvoiceMonth: current.cardEntryType === "invoice_payment"
        ? current.cardInvoiceMonth
        : effectiveCardId
          ? invoiceMonthForPurchase(dateOnly(date) ?? current.date, effectiveCardClosingDay ?? 31)
          : null,
    } : {}),
    ...(type === undefined ? {} : { type }),
    ...(paymentStatus === undefined ? {} : { paymentStatus }),
    ...(categoryId === undefined ? {} : { categoryId }),
    ...(goalId === undefined ? {} : { goalId }),
    ...(destinationWalletId === undefined && type === undefined
      ? {}
      : { destinationWalletId: effectiveType === "transfer" ? destinationWallet?.id : null }),
  };
  const [row] = await db.update(transactionsTable).set(updates)
    .where(and(eq(transactionsTable.id, params.data.id), eq(transactionsTable.userId, userId)))
    .returning();
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
  const defaultWallet = await ensureDefaultWallet(userId);
  await db.update(transactionsTable)
    .set({ walletId: defaultWallet.id })
    .where(and(eq(transactionsTable.userId, userId), isNull(transactionsTable.walletId)));
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

router.post("/transactions/batch-update", async (req, res): Promise<void> => {
  const body = UpdateTransactionsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid transaction update" });
    return;
  }
  const userId = userIdFrom(req);
  const { ids, walletId, categoryId, dueDate, paymentStatus } = body.data;

  if (walletId !== undefined && !(await getUserWallet(userId, walletId))) {
    res.status(400).json({ error: "Wallet not found" });
    return;
  }
  if (categoryId !== undefined && categoryId !== null) {
    const [category] = await db.select().from(categoriesTable)
      .where(and(eq(categoriesTable.id, categoryId), eq(categoriesTable.userId, userId)));
    if (!category) {
      res.status(400).json({ error: "Category not found" });
      return;
    }
  }

  await db.update(transactionsTable)
    .set({
      ...(walletId === undefined ? {} : { walletId }),
      ...(categoryId === undefined ? {} : { categoryId }),
      ...(dueDate === undefined ? {} : { dueDate: dateOnly(dueDate) }),
      ...(paymentStatus === undefined ? {} : { paymentStatus }),
    })
    .where(and(eq(transactionsTable.userId, userId), inArray(transactionsTable.id, ids)));
  res.sendStatus(204);
});

router.delete("/transactions", async (req, res): Promise<void> => {
  const userId = userIdFrom(req);
  await db.delete(transactionsTable).where(eq(transactionsTable.userId, userId));
  res.sendStatus(204);
});

export default router;