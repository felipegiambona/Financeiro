import { and, asc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { cardsTable, categoriesTable, db, transactionsTable } from "@workspace/db";
import {
  CreateCardBody,
  CreateCardResponse,
  DeleteCardParams,
  GetCardHistoryParams,
  GetCardHistoryResponse,
  GetCardParams,
  GetCardResponse,
  ListCardsResponse,
  PayCardInvoiceParams,
  PayCardInvoiceResponse,
  UpdateCardBody,
  UpdateCardParams,
  UpdateCardResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { ensureDefaultWallet } from "./wallets";

const router: IRouter = Router();
router.use("/cards", requireAuth);

function userIdFrom(req: unknown): string {
  return (req as AuthenticatedRequest).userId;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dayDate(month: Date, day: number): string {
  const safeDay = Math.min(day, new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate());
  return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

function toResponse(row: typeof cardsTable.$inferSelect, currentInvoiceAmount: number, now = new Date()) {
  return {
    ...row,
    currentInvoiceAmount,
    availableLimit: row.availableLimit == null ? null : Number(row.availableLimit),
    invoiceStatus: now.getDate() >= row.closingDay ? "closed" : "open",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getCardForUser(userId: string, cardId: string) {
  const [card] = await db.select().from(cardsTable).where(and(
    eq(cardsTable.id, cardId),
    eq(cardsTable.userId, userId),
  ));
  return card;
}

async function getCardPurchaseRows(userId: string, cardId: string) {
  return db.select().from(transactionsTable).where(and(
    eq(transactionsTable.userId, userId),
    eq(transactionsTable.cardId, cardId),
    eq(transactionsTable.type, "expense"),
  ));
}

function invoiceAmount(rows: Array<typeof transactionsTable.$inferSelect>, now = new Date()): number {
  const key = monthKey(now);
  return Math.max(0, Math.round(rows
    .filter((row) => row.date.slice(0, 7) === key)
    .reduce((total, row) => total + (row.cardEntryType === "invoice_payment" ? -Number(row.amount) : Number(row.amount)), 0) * 100) / 100);
}

router.get("/cards", async (req, res): Promise<void> => {
  const rows = await db.select().from(cardsTable)
    .where(eq(cardsTable.userId, userIdFrom(req)))
    .orderBy(asc(cardsTable.createdAt));
  const now = new Date();
  const cards = await Promise.all(rows.map(async (row) => {
    const transactions = await getCardPurchaseRows(userIdFrom(req), row.id);
    return toResponse(row, invoiceAmount(transactions, now), now);
  }));
  res.json(ListCardsResponse.parse(cards));
});

router.post("/cards", async (req, res): Promise<void> => {
  const parsed = CreateCardBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(cardsTable).values({
    userId: userIdFrom(req),
    name: parsed.data.name.trim(),
    dueDay: parsed.data.dueDay,
    closingDay: parsed.data.closingDay,
    availableLimit: parsed.data.availableLimit == null ? null : String(parsed.data.availableLimit),
  }).returning();
  res.status(201).json(CreateCardResponse.parse(toResponse(row, 0)));
});

router.get("/cards/:id", async (req, res): Promise<void> => {
  const params = GetCardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid card id" });
    return;
  }
  const userId = userIdFrom(req);
  const [row] = await db.select().from(cardsTable).where(and(
    eq(cardsTable.id, params.data.id),
    eq(cardsTable.userId, userId),
  ));
  if (!row) {
    res.status(404).json({ error: "Card not found" });
    return;
  }
  const now = new Date();
  const transactions = await getCardPurchaseRows(userId, row.id);
  res.json(GetCardResponse.parse(toResponse(row, invoiceAmount(transactions, now), now)));
});

router.patch("/cards/:id", async (req, res): Promise<void> => {
  const params = UpdateCardParams.safeParse(req.params);
  const body = UpdateCardBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid card update" });
    return;
  }
  const updates = {
    ...(body.data.name === undefined ? {} : { name: body.data.name.trim() }),
    ...(body.data.dueDay === undefined ? {} : { dueDay: body.data.dueDay }),
    ...(body.data.closingDay === undefined ? {} : { closingDay: body.data.closingDay }),
    ...(body.data.availableLimit === undefined ? {} : { availableLimit: body.data.availableLimit == null ? null : String(body.data.availableLimit) }),
  };
  const [row] = await db.update(cardsTable).set(updates)
    .where(and(eq(cardsTable.id, params.data.id), eq(cardsTable.userId, userIdFrom(req))))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Card not found" });
    return;
  }
  const transactions = await getCardPurchaseRows(userIdFrom(req), row.id);
  res.json(UpdateCardResponse.parse(toResponse(row, invoiceAmount(transactions))));
});

router.delete("/cards/:id", async (req, res): Promise<void> => {
  const params = DeleteCardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid card id" });
    return;
  }
  const [row] = await db.delete(cardsTable)
    .where(and(eq(cardsTable.id, params.data.id), eq(cardsTable.userId, userIdFrom(req))))
    .returning({ id: cardsTable.id });
  if (!row) {
    res.status(404).json({ error: "Card not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/cards/:id/pay-invoice", async (req, res): Promise<void> => {
  const params = PayCardInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid card id" });
    return;
  }
  const userId = userIdFrom(req);
  const existing = await getCardForUser(userId, params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Card not found" });
    return;
  }
  const transactions = await getCardPurchaseRows(userId, existing.id);
  const currentInvoiceAmount = invoiceAmount(transactions);
  if (currentInvoiceAmount <= 0) {
    res.status(400).json({ error: "No open invoice to pay" });
    return;
  }
  const wallet = await ensureDefaultWallet(userId);
  await db.insert(transactionsTable).values({
    userId,
    walletId: wallet.id,
    cardId: existing.id,
    cardEntryType: "invoice_payment",
    destinationWalletId: null,
    categoryId: null,
    goalId: null,
    type: "expense",
    amount: String(currentInvoiceAmount),
    description: `Pagamento da fatura - ${existing.name}`,
    date: new Date().toISOString().slice(0, 10),
    dueDate: null,
    recurrence: { kind: "none" },
    paymentStatus: "paid",
    paymentStatusOverrides: {},
  });
  const refreshedTransactions = await getCardPurchaseRows(userId, existing.id);
  res.json(PayCardInvoiceResponse.parse(toResponse(existing, invoiceAmount(refreshedTransactions))));
});

router.get("/cards/:id/history", async (req, res): Promise<void> => {
  const params = GetCardHistoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid card id" });
    return;
  }
  const userId = userIdFrom(req);
  const card = await getCardForUser(userId, params.data.id);
  if (!card) {
    res.status(404).json({ error: "Card not found" });
    return;
  }
  const now = new Date();
  const rows = await getCardPurchaseRows(userId, card.id);
  const categoryIds = rows.map((row) => row.categoryId).filter((id): id is string => Boolean(id));
  const categories = categoryIds.length === 0
    ? []
    : await db.select().from(categoriesTable).where(and(
      eq(categoriesTable.userId, userId),
    ));
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const history: Array<{
    id: string;
    kind: "transaction" | "closure";
    description: string;
    amount: number;
    date: string;
    paymentStatus: "paid" | "unpaid";
    categoryName: string | null;
  }> = rows
    .filter((row) => row.date.slice(0, 7) === monthKey(now))
    .map((row) => ({
      id: row.id,
      kind: "transaction" as const,
      description: row.description,
      amount: Number(row.amount),
      date: row.date,
      paymentStatus: row.paymentStatus as "paid" | "unpaid",
      categoryName: row.categoryId ? categoryNames.get(row.categoryId) ?? null : null,
    }));
  if (now.getDate() >= card.closingDay) {
    history.push({
      id: `closure-${card.id}-${monthKey(now)}`,
      kind: "closure" as const,
      description: "Fatura fechada",
      amount: 0,
      date: dayDate(now, card.closingDay),
      paymentStatus: "paid" as const,
      categoryName: null,
    });
  }
  history.sort((a, b) => a.date.localeCompare(b.date));
  res.json(GetCardHistoryResponse.parse(history));
});

export default router;