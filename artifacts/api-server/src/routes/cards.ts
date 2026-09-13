import { and, asc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { cardsTable, db } from "@workspace/db";
import {
  CreateCardBody,
  CreateCardResponse,
  DeleteCardParams,
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

const router: IRouter = Router();
router.use("/cards", requireAuth);

function userIdFrom(req: unknown): string {
  return (req as AuthenticatedRequest).userId;
}

function toResponse(row: typeof cardsTable.$inferSelect) {
  return {
    ...row,
    currentInvoiceAmount: Number(row.currentInvoiceAmount),
    availableLimit: row.availableLimit == null ? null : Number(row.availableLimit),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

router.get("/cards", async (req, res): Promise<void> => {
  const rows = await db.select().from(cardsTable)
    .where(eq(cardsTable.userId, userIdFrom(req)))
    .orderBy(asc(cardsTable.createdAt));
  res.json(ListCardsResponse.parse(rows.map(toResponse)));
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
    currentInvoiceAmount: String(parsed.data.currentInvoiceAmount ?? 0),
    availableLimit: parsed.data.availableLimit == null ? null : String(parsed.data.availableLimit),
    invoiceStatus: parsed.data.invoiceStatus ?? "open",
  }).returning();
  res.status(201).json(CreateCardResponse.parse(toResponse(row)));
});

router.get("/cards/:id", async (req, res): Promise<void> => {
  const params = GetCardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid card id" });
    return;
  }
  const [row] = await db.select().from(cardsTable).where(and(
    eq(cardsTable.id, params.data.id),
    eq(cardsTable.userId, userIdFrom(req)),
  ));
  if (!row) {
    res.status(404).json({ error: "Card not found" });
    return;
  }
  res.json(GetCardResponse.parse(toResponse(row)));
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
    ...(body.data.currentInvoiceAmount === undefined ? {} : { currentInvoiceAmount: String(body.data.currentInvoiceAmount) }),
    ...(body.data.availableLimit === undefined ? {} : { availableLimit: body.data.availableLimit == null ? null : String(body.data.availableLimit) }),
    ...(body.data.invoiceStatus === undefined ? {} : { invoiceStatus: body.data.invoiceStatus }),
  };
  const [row] = await db.update(cardsTable).set(updates)
    .where(and(eq(cardsTable.id, params.data.id), eq(cardsTable.userId, userIdFrom(req))))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Card not found" });
    return;
  }
  res.json(UpdateCardResponse.parse(toResponse(row)));
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
  const [existing] = await db.select().from(cardsTable).where(and(
    eq(cardsTable.id, params.data.id),
    eq(cardsTable.userId, userId),
  ));
  if (!existing) {
    res.status(404).json({ error: "Card not found" });
    return;
  }
  const currentInvoiceAmount = Number(existing.currentInvoiceAmount);
  const nextAvailableLimit = existing.availableLimit == null
    ? null
    : String(Math.round((Number(existing.availableLimit) + currentInvoiceAmount) * 100) / 100);
  const [row] = await db.update(cardsTable)
    .set({ currentInvoiceAmount: "0", availableLimit: nextAvailableLimit, invoiceStatus: "open" })
    .where(and(eq(cardsTable.id, params.data.id), eq(cardsTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Card not found" });
    return;
  }
  res.json(PayCardInvoiceResponse.parse(toResponse(row)));
});

export default router;