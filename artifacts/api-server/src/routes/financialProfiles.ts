import { and, asc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, financialProfilesTable } from "@workspace/db";
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

export default router;