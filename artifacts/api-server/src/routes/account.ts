import { clerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { categoriesTable, db, transactionsTable, walletsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

function userIdFrom(req: unknown): string {
  return (req as AuthenticatedRequest).userId;
}

router.delete("/account", requireAuth, async (req, res): Promise<void> => {
  const userId = userIdFrom(req);

  await db.transaction(async (tx) => {
    await tx.delete(transactionsTable).where(eq(transactionsTable.userId, userId));
    await tx.delete(categoriesTable).where(eq(categoriesTable.userId, userId));
    await tx.delete(walletsTable).where(eq(walletsTable.userId, userId));
  });

  await clerkClient.users.deleteUser(userId);
  res.sendStatus(204);
});

router.patch("/account/profile", requireAuth, async (req, res): Promise<void> => {
  const userId = userIdFrom(req);
  const firstName = typeof req.body?.firstName === "string" ? req.body.firstName.trim() : "";
  const lastName = typeof req.body?.lastName === "string" ? req.body.lastName.trim() : "";

  if (!firstName) {
    res.status(400).json({ error: "firstName is required" });
    return;
  }

  await clerkClient.users.updateUser(userId, {
    firstName,
    ...(lastName ? { lastName } : {}),
  });
  res.sendStatus(204);
});

export default router;