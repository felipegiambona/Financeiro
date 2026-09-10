import { Router, type IRouter } from "express";
import { and, asc, eq, ne } from "drizzle-orm";
import { db, transactionsTable, walletsTable } from "@workspace/db";
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

export async function ensureDefaultWallet(userId: string) {
  const existing = await db.select().from(walletsTable)
    .where(eq(walletsTable.userId, userId))
    .orderBy(asc(walletsTable.createdAt));
  const currentDefault = existing.find((wallet) => wallet.isDefault);
  if (currentDefault) return currentDefault;

  if (existing[0]) {
    const [updated] = await db.update(walletsTable)
      .set({ isDefault: true })
      .where(and(eq(walletsTable.id, existing[0].id), eq(walletsTable.userId, userId)))
      .returning();
    return updated;
  }

  const [created] = await db.insert(walletsTable).values({
    userId,
    title: "Carteira padrão",
    initialBalance: "0",
    icon: "wallet-outline",
    isDefault: true,
  }).returning();
  return created;
}

export async function getUserWallet(userId: string, walletId?: string) {
  const defaultWallet = await ensureDefaultWallet(userId);
  if (!walletId) return defaultWallet;
  const [wallet] = await db.select().from(walletsTable)
    .where(and(eq(walletsTable.id, walletId), eq(walletsTable.userId, userId)));
  return wallet ?? null;
}

function toResponse(row: typeof walletsTable.$inferSelect) {
  return {
    ...row,
    icon: "wallet-outline",
    initialBalance: Number(row.initialBalance),
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeWallet(row: typeof walletsTable.$inferSelect) {
  return CreateWalletResponse.parse(toResponse(row));
}

async function standardizeWalletIcons(userId: string) {
  await db.update(walletsTable)
    .set({ icon: "wallet-outline" })
    .where(and(
      eq(walletsTable.userId, userId),
      ne(walletsTable.icon, "wallet-outline"),
    ));
}

router.get("/wallets", async (req, res): Promise<void> => {
  const userId = userIdFrom(req);
  await ensureDefaultWallet(userId);
  await standardizeWalletIcons(userId);
  const rows = await db.select().from(walletsTable)
    .where(eq(walletsTable.userId, userId))
    .orderBy(asc(walletsTable.createdAt));
  res.json(ListWalletsResponse.parse(rows.map(toResponse)));
});

router.post("/wallets", async (req, res): Promise<void> => {
  const parsed = CreateWalletBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = userIdFrom(req);
  await ensureDefaultWallet(userId);
  const [row] = await db.insert(walletsTable).values({
    title: parsed.data.title,
    userId,
    initialBalance: String(parsed.data.initialBalance),
    icon: "wallet-outline",
    isDefault: false,
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
    icon: "wallet-outline",
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
  const userId = userIdFrom(req);
  const [wallet] = await db.select().from(walletsTable)
    .where(and(eq(walletsTable.id, params.data.id), eq(walletsTable.userId, userId)));
  if (!wallet) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }

  const existing = await db.select().from(walletsTable)
    .where(eq(walletsTable.userId, userId))
    .orderBy(asc(walletsTable.createdAt));
  let replacement = existing.find((candidate) => candidate.id !== wallet.id && candidate.isDefault)
    ?? existing.find((candidate) => candidate.id !== wallet.id);
  if (!replacement) {
    const [created] = await db.insert(walletsTable).values({
      userId,
      title: "Carteira padrão",
      initialBalance: "0",
      icon: "wallet-outline",
      isDefault: true,
    }).returning();
    replacement = created;
  } else if (!replacement.isDefault) {
    const [updated] = await db.update(walletsTable)
      .set({ isDefault: true })
      .where(and(eq(walletsTable.id, replacement.id), eq(walletsTable.userId, userId)))
      .returning();
    replacement = updated;
  }

  await db.update(transactionsTable)
    .set({ walletId: replacement.id })
    .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.walletId, wallet.id)));
  await db.update(transactionsTable)
    .set({ destinationWalletId: replacement.id })
    .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.destinationWalletId, wallet.id)));
  await db.delete(walletsTable)
    .where(and(eq(walletsTable.id, wallet.id), eq(walletsTable.userId, userId)));
  res.sendStatus(204);
});

export default router;