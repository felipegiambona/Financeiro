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
import { profileIdFrom, requireAuth, resolveFinancialProfile, scopedUserIdFrom } from "../middlewares/requireAuth";
import {
  dateKey,
  getCardInvoiceSummaries,
  monthKey,
  type CardInvoiceSummary,
} from "../services/cardInvoices";
import { ensureDefaultWallet } from "./wallets";

const router: IRouter = Router();
router.use("/cards", requireAuth, resolveFinancialProfile);

const userIdFrom = scopedUserIdFrom;

function toResponse(
  row: typeof cardsTable.$inferSelect,
  invoices: CardInvoiceSummary[],
  now = new Date(),
) {
  const currentInvoice = invoices.find((invoice) => invoice.invoiceMonth === monthKey(now));
  return {
    ...row,
    currentInvoiceAmount: currentInvoice?.amount ?? 0,
    availableLimit: row.availableLimit == null ? null : Number(row.availableLimit),
    invoiceStatus: currentInvoice?.status ?? "open",
    invoices,
    overdueInvoices: invoices.filter((invoice) => invoice.status === "overdue"),
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

async function getCardRows(userId: string, cardId: string) {
  return db.select().from(transactionsTable).where(and(
    eq(transactionsTable.userId, userId),
    eq(transactionsTable.cardId, cardId),
    eq(transactionsTable.type, "expense"),
  ));
}

router.get("/cards", async (req, res): Promise<void> => {
  const rows = await db.select().from(cardsTable)
    .where(eq(cardsTable.userId, userIdFrom(req)))
    .orderBy(asc(cardsTable.createdAt));
  const now = new Date();
  const cards = await Promise.all(rows.map(async (row) => {
    const transactions = await getCardRows(userIdFrom(req), row.id);
    return toResponse(row, getCardInvoiceSummaries(transactions, row.closingDay, row.dueDay, now), now);
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
    profileId: profileIdFrom(req),
    name: parsed.data.name.trim(),
    dueDay: parsed.data.dueDay,
    closingDay: parsed.data.closingDay,
    availableLimit: parsed.data.availableLimit == null ? null : String(parsed.data.availableLimit),
  }).returning();
  res.status(201).json(CreateCardResponse.parse(toResponse(row, getCardInvoiceSummaries([], row.closingDay, row.dueDay))));
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
  const transactions = await getCardRows(userId, row.id);
  res.json(GetCardResponse.parse(toResponse(row, getCardInvoiceSummaries(transactions, row.closingDay, row.dueDay, now), now)));
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
  const transactions = await getCardRows(userIdFrom(req), row.id);
  res.json(UpdateCardResponse.parse(toResponse(row, getCardInvoiceSummaries(transactions, row.closingDay, row.dueDay))));
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
  const transactions = await getCardRows(userId, existing.id);
  const invoices = getCardInvoiceSummaries(transactions, existing.closingDay, existing.dueDay);
  const requestedMonth = typeof req.body?.invoiceMonth === "string" && /^\d{4}-\d{2}$/.test(req.body.invoiceMonth)
    ? req.body.invoiceMonth
    : monthKey(new Date());
  const invoice = invoices.find((item) => item.invoiceMonth === requestedMonth);
  if (!invoice || invoice.amount <= 0 || invoice.status === "paid") {
    res.status(400).json({ error: "No open invoice to pay" });
    return;
  }
  const wallet = await ensureDefaultWallet(userId);
  await db.insert(transactionsTable).values({
    userId,
    profileId: profileIdFrom(req),
    walletId: wallet.id,
    cardId: existing.id,
    cardEntryType: "invoice_payment",
    cardInvoiceMonth: requestedMonth,
    destinationWalletId: null,
    categoryId: null,
    goalId: null,
    type: "expense",
    amount: String(invoice.amount),
    description: `Pagamento da fatura ${requestedMonth} - ${existing.name}`,
    date: new Date().toISOString().slice(0, 10),
    dueDate: null,
    recurrence: { kind: "none" },
    paymentStatus: "paid",
    paymentStatusOverrides: {},
  });
  const refreshedTransactions = await getCardRows(userId, existing.id);
  res.json(PayCardInvoiceResponse.parse(toResponse(
    existing,
    getCardInvoiceSummaries(refreshedTransactions, existing.closingDay, existing.dueDay),
  )));
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
  const rows = await getCardRows(userId, card.id);
  const categoryIds = rows.map((row) => row.categoryId).filter((id): id is string => Boolean(id));
  const categories = categoryIds.length === 0
    ? []
    : await db.select().from(categoriesTable).where(and(
      eq(categoriesTable.userId, userId),
    ));
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const invoices = getCardInvoiceSummaries(rows, card.closingDay, card.dueDay, now);
  const history: Array<{
    id: string;
    kind: "transaction" | "closure";
    description: string;
    amount: number;
    date: string;
    paymentStatus: "paid" | "unpaid";
    categoryName: string | null;
  }> = rows.map((row) => ({
      id: row.id,
      kind: "transaction" as const,
      description: row.description,
      amount: Number(row.amount),
      date: row.date,
      paymentStatus: row.paymentStatus as "paid" | "unpaid",
      categoryName: row.categoryId ? categoryNames.get(row.categoryId) ?? null : null,
    }));
  const today = dateKey(now);
  for (const invoice of invoices) {
    if (invoice.amount <= 0 || invoice.closingDate > today) continue;
    history.push({
      id: `closure-${card.id}-${invoice.invoiceMonth}`,
      kind: "closure" as const,
      description: "Fatura fechada",
      amount: 0,
      date: invoice.closingDate,
      paymentStatus: "paid" as const,
      categoryName: null,
    });
  }
  history.sort((a, b) => b.date.localeCompare(a.date));
  res.json(GetCardHistoryResponse.parse(history));
});

export default router;