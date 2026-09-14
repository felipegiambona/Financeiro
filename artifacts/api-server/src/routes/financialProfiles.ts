import { and, asc, eq, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  cardsTable,
  categoriesTable,
  db,
  financialProfilesTable,
  goalMovementsTable,
  goalsTable,
  investmentsTable,
  limitsTable,
  transactionsTable,
  walletsTable,
} from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

function userIdFrom(req: unknown): string {
  return (req as AuthenticatedRequest).userId;
}

function toResponse(profile: typeof financialProfilesTable.$inferSelect) {
  return {
    id: profile.id,
    type: profile.type,
    name: profile.name,
    businessName: profile.businessName,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

router.use("/financial-profiles", requireAuth);

router.get("/financial-profiles", async (req, res): Promise<void> => {
  const userId = userIdFrom(req);
  let profiles = await db.select().from(financialProfilesTable)
    .where(eq(financialProfilesTable.userId, userId))
    .orderBy(asc(financialProfilesTable.createdAt));

  if (!profiles.some((profile) => profile.type === "personal")) {
    const [personal] = await db.insert(financialProfilesTable).values({
      userId,
      type: "personal",
      name: "Pessoal",
    }).returning();
    profiles = [personal, ...profiles];
  }

  res.json(profiles.map(toResponse));
});

router.post("/financial-profiles", async (req, res): Promise<void> => {
  const type = req.body?.type === "business" ? "business" : req.body?.type === "personal" ? "personal" : null;
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const businessName = typeof req.body?.businessName === "string" ? req.body.businessName.trim() : "";

  if (!type || !name) {
    res.status(400).json({ error: "type and name are required" });
    return;
  }
  if (type === "personal") {
    const [existingPersonal] = await db.select({ id: financialProfilesTable.id })
      .from(financialProfilesTable)
      .where(and(eq(financialProfilesTable.userId, userIdFrom(req)), eq(financialProfilesTable.type, "personal")))
      .limit(1);
    if (existingPersonal) {
      res.status(409).json({ error: "Personal profile already exists" });
      return;
    }
  }
  if (type === "business" && !businessName) {
    res.status(400).json({ error: "businessName is required for business profiles" });
    return;
  }

  const [profile] = await db.insert(financialProfilesTable).values({
    userId: userIdFrom(req),
    type,
    name,
    businessName: type === "business" ? businessName : null,
  }).returning();
  res.status(201).json(toResponse(profile));
});

router.delete("/financial-profiles/:profileId", async (req, res): Promise<void> => {
  const userId = userIdFrom(req);
  const profileId = req.params.profileId;
  const [profile] = await db.select()
    .from(financialProfilesTable)
    .where(and(
      eq(financialProfilesTable.id, profileId),
      eq(financialProfilesTable.userId, userId),
    ))
    .limit(1);

  if (!profile) {
    res.status(404).json({ error: "Financial profile not found" });
    return;
  }
  if (profile.type !== "business") {
    res.status(400).json({ error: "The personal profile cannot be deleted" });
    return;
  }

  const scopedUserId = `${userId}::${profile.id}`;
  await db.transaction(async (tx) => {
    await tx.delete(transactionsTable).where(or(
      eq(transactionsTable.profileId, profile.id),
      eq(transactionsTable.userId, scopedUserId),
    ));
    await tx.delete(goalMovementsTable).where(or(
      eq(goalMovementsTable.profileId, profile.id),
      eq(goalMovementsTable.userId, scopedUserId),
    ));
    await tx.delete(limitsTable).where(or(
      eq(limitsTable.profileId, profile.id),
      eq(limitsTable.userId, scopedUserId),
    ));
    await tx.delete(goalsTable).where(or(
      eq(goalsTable.profileId, profile.id),
      eq(goalsTable.userId, scopedUserId),
    ));
    await tx.delete(cardsTable).where(or(
      eq(cardsTable.profileId, profile.id),
      eq(cardsTable.userId, scopedUserId),
    ));
    await tx.delete(investmentsTable).where(or(
      eq(investmentsTable.profileId, profile.id),
      eq(investmentsTable.userId, scopedUserId),
    ));
    await tx.delete(categoriesTable).where(or(
      eq(categoriesTable.profileId, profile.id),
      eq(categoriesTable.userId, scopedUserId),
    ));
    await tx.delete(walletsTable).where(or(
      eq(walletsTable.profileId, profile.id),
      eq(walletsTable.userId, scopedUserId),
    ));
    await tx.delete(financialProfilesTable).where(and(
      eq(financialProfilesTable.id, profile.id),
      eq(financialProfilesTable.userId, userId),
    ));
  });

  res.sendStatus(204);
});

export default router;