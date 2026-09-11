import { clerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { categoriesTable, db, limitsTable, transactionsTable, walletsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

function userIdFrom(req: unknown): string {
  return (req as AuthenticatedRequest).userId;
}

router.delete("/account", requireAuth, async (req, res): Promise<void> => {
  const userId = userIdFrom(req);

  await db.transaction(async (tx) => {
    await tx.delete(transactionsTable).where(eq(transactionsTable.userId, userId));
    await tx.delete(limitsTable).where(eq(limitsTable.userId, userId));
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

router.patch(
  "/account/profile-image",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = userIdFrom(req);
    const base64Data = typeof req.body?.data === "string" ? req.body.data : "";
    const contentType = typeof req.body?.mimeType === "string" ? req.body.mimeType : "";

    if (!base64Data || !["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
      res.status(400).json({ error: "A profile image is required" });
      return;
    }

    const file = Buffer.from(base64Data, "base64");
    if (file.length === 0) {
      res.status(400).json({ error: "A valid profile image is required" });
      return;
    }

    const imageBytes = new Uint8Array(file.byteLength);
    imageBytes.set(file);
    await clerkClient.users.updateUserProfileImage(userId, {
      file: new Blob([imageBytes.buffer], { type: contentType }),
    });
    res.sendStatus(204);
  },
);

export default router;