import { clerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, transactionsTable, walletsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

function userIdFrom(req: unknown): string {
  return (req as AuthenticatedRequest).userId;
}

router.delete("/account", requireAuth, async (req, res): Promise<void> => {
  const userId = userIdFrom(req);

  await db.transaction(async (tx) => {
    await tx.delete(transactionsTable).where(eq(transactionsTable.userId, userId));
    await tx.delete(walletsTable).where(eq(walletsTable.userId, userId));
  });

  await clerkClient.users.deleteUser(userId);
  res.sendStatus(204);
});

export default router;