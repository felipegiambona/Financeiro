import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, walletsTable } from "@workspace/db";
import {
  CreateWalletBody,
  CreateWalletResponse,
  ListWalletsResponse,
  UpdateWalletBody,
  UpdateWalletParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();
router.use("/wallets", requireAuth);

function userIdFrom(req: unknown): string {
  return (req as AuthenticatedRequest).userId;
}

function toResponse(row: typeof walletsTable.$inferSelect) {
  return {
    ...row,
    initialBalance: Number(row.initialBalance),
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeWallet(row: typeof walletsTable.$inferSelect) {
  return CreateWalletResponse.parse(toResponse(row));
}

router.get("/wallets", async (req, res): Promise<void> => {
  const rows = await db.select().from(walletsTable)
    .where(eq(walletsTable.userId, userIdFrom(req)))
    .orderBy(asc(walletsTable.createdAt));
  res.json(ListWalletsResponse.parse(rows.map(toResponse)));
});

router.post("/wallets", async (req, res): Promise<void> => {
  const parsed = CreateWalletBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(walletsTable).values({
    ...parsed.data,
    userId: userIdFrom(req),
    initialBalance: String(parsed.data.initialBalance),
  }).returning();
  res.status(201).json(serializeWallet(row));
});

router.patch("/wallets/:id", async (req, res): Promise<void> => {
  const params = UpdateWalletParams.safeParse(req.params);
  const body = UpdateWalletBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid wallet update" });
    return;
  }
  const { initialBalance, ...otherUpdates } = body.data;
  const updates = {
    ...otherUpdates,
    ...(initialBalance === undefined ? {} : { initialBalance: String(initialBalance) }),
  };
  const [row] = await db.update(walletsTable).set(updates)
    .where(and(eq(walletsTable.id, params.data.id), eq(walletsTable.userId, userIdFrom(req))))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }
  res.json(serializeWallet(row));
});

router.delete("/wallets/:id", async (req, res): Promise<void> => {
  const params = UpdateWalletParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid wallet id" });
    return;
  }
  const [row] = await db.delete(walletsTable)
    .where(and(eq(walletsTable.id, params.data.id), eq(walletsTable.userId, userIdFrom(req))))
    .returning({ id: walletsTable.id });
  if (!row) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;