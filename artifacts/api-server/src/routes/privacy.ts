import { and, desc, eq, like, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  cardsTable,
  categoriesTable,
  db,
  financialProfilesTable,
  goalMovementsTable,
  goalsTable,
  investmentFavoritesTable,
  investmentsTable,
  limitsTable,
  privacyConsentsTable,
  privacyRequestsTable,
  supportRequestsTable,
  transactionsTable,
  walletsTable,
} from "@workspace/db";
import { getLegalDocument, legalDocumentVersion } from "../lib/legalDocuments";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

function userIdFrom(req: unknown): string {
  return (req as AuthenticatedRequest).userId;
}

function ownerFilter(column: unknown, userId: string) {
  const sqlColumn = column as Parameters<typeof eq>[0];
  return or(eq(sqlColumn, userId), like(sqlColumn as never, `${userId}::%`));
}

function consentResponse(consent: typeof privacyConsentsTable.$inferSelect) {
  return {
    id: consent.id,
    documentKey: consent.documentKey,
    documentVersion: consent.documentVersion,
    acceptedAt: consent.acceptedAt.toISOString(),
    revokedAt: consent.revokedAt?.toISOString() ?? null,
    active: !consent.revokedAt,
  };
}

function requestResponse(request: typeof privacyRequestsTable.$inferSelect) {
  return {
    id: request.id,
    profileId: request.profileId,
    requestType: request.requestType,
    status: request.status,
    details: request.details,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    completedAt: request.completedAt?.toISOString() ?? null,
  };
}

function supportResponse(request: typeof supportRequestsTable.$inferSelect) {
  return {
    id: request.id,
    category: request.category,
    subject: request.subject,
    message: request.message,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  };
}

router.use("/privacy", requireAuth);
router.use("/support", requireAuth);

router.get("/privacy/consents", async (req, res): Promise<void> => {
  const consents = await db.select().from(privacyConsentsTable)
    .where(eq(privacyConsentsTable.userId, userIdFrom(req)))
    .orderBy(desc(privacyConsentsTable.acceptedAt));
  res.json({
    currentDocumentVersion: legalDocumentVersion,
    consents: consents.map(consentResponse),
  });
});

router.post("/privacy/consents", async (req, res): Promise<void> => {
  const userId = userIdFrom(req);
  const documentKey = typeof req.body?.documentKey === "string" ? req.body.documentKey : "";
  const documentVersion = typeof req.body?.documentVersion === "string"
    ? req.body.documentVersion
    : legalDocumentVersion;
  const accepted = req.body?.accepted !== false;
  const document = getLegalDocument(documentKey);

  if (documentKey === "communications") {
    if (documentVersion !== legalDocumentVersion) {
      res.status(409).json({ error: "Consent version is no longer current" });
      return;
    }
  } else if (!document || !document.requiresAcceptance) {
    res.status(400).json({ error: "Only an accepting legal document can be recorded" });
    return;
  }
  if (document && documentVersion !== document.version) {
    res.status(409).json({ error: "Document version is no longer current" });
    return;
  }

  if (!accepted) {
    await db.update(privacyConsentsTable)
      .set({ revokedAt: new Date() })
      .where(and(
        eq(privacyConsentsTable.userId, userId),
        eq(privacyConsentsTable.documentKey, documentKey),
        eq(privacyConsentsTable.documentVersion, documentVersion),
      ));
    res.sendStatus(204);
    return;
  }

  const [consent] = await db.insert(privacyConsentsTable).values({
    userId,
    documentKey,
    documentVersion,
  }).returning();
  res.status(201).json(consentResponse(consent));
});

router.get("/privacy/requests", async (req, res): Promise<void> => {
  const requests = await db.select().from(privacyRequestsTable)
    .where(eq(privacyRequestsTable.userId, userIdFrom(req)))
    .orderBy(desc(privacyRequestsTable.createdAt));
  res.json(requests.map(requestResponse));
});

router.post("/privacy/requests", async (req, res): Promise<void> => {
  const userId = userIdFrom(req);
  const requestType = typeof req.body?.requestType === "string" ? req.body.requestType : "";
  const details = typeof req.body?.details === "string" ? req.body.details.trim().slice(0, 2000) : null;
  const profileId = typeof req.body?.profileId === "string" ? req.body.profileId : null;
  const validTypes = ["access", "correction", "export", "deletion", "withdraw_consent"];

  if (!validTypes.includes(requestType)) {
    res.status(400).json({ error: "Invalid privacy request type" });
    return;
  }
  if (profileId) {
    const [profile] = await db.select({ id: financialProfilesTable.id })
      .from(financialProfilesTable)
      .where(and(eq(financialProfilesTable.id, profileId), eq(financialProfilesTable.userId, userId)))
      .limit(1);
    if (!profile) {
      res.status(403).json({ error: "Financial profile not found" });
      return;
    }
  }

  const [request] = await db.insert(privacyRequestsTable).values({
    userId,
    profileId,
    requestType,
    details,
  }).returning();
  res.status(201).json(requestResponse(request));
});

router.get("/privacy/export", async (req, res): Promise<void> => {
  const userId = userIdFrom(req);
  const [
    profiles,
    transactions,
    wallets,
    categories,
    limits,
    goals,
    goalMovements,
    cards,
    investments,
    investmentFavorites,
    consents,
    privacyRequests,
    supportRequests,
  ] = await Promise.all([
    db.select().from(financialProfilesTable).where(eq(financialProfilesTable.userId, userId)),
    db.select().from(transactionsTable).where(ownerFilter(transactionsTable.userId, userId)),
    db.select().from(walletsTable).where(ownerFilter(walletsTable.userId, userId)),
    db.select().from(categoriesTable).where(ownerFilter(categoriesTable.userId, userId)),
    db.select().from(limitsTable).where(ownerFilter(limitsTable.userId, userId)),
    db.select().from(goalsTable).where(ownerFilter(goalsTable.userId, userId)),
    db.select().from(goalMovementsTable).where(ownerFilter(goalMovementsTable.userId, userId)),
    db.select().from(cardsTable).where(ownerFilter(cardsTable.userId, userId)),
    db.select().from(investmentsTable).where(ownerFilter(investmentsTable.userId, userId)),
    db.select().from(investmentFavoritesTable).where(ownerFilter(investmentFavoritesTable.userId, userId)),
    db.select().from(privacyConsentsTable).where(eq(privacyConsentsTable.userId, userId)),
    db.select().from(privacyRequestsTable).where(eq(privacyRequestsTable.userId, userId)),
    db.select().from(supportRequestsTable).where(eq(supportRequestsTable.userId, userId)),
  ]);

  res.json({
    exportedAt: new Date().toISOString(),
    format: "financas-mobile-export-v1",
    account: {
      userId,
      financialProfiles: profiles,
    },
    financialData: {
      transactions,
      wallets,
      categories,
      limits,
      goals,
      goalMovements,
      cards,
      investments,
      investmentFavorites,
    },
    privacy: {
      consents,
      requests: privacyRequests,
    },
    support: {
      requests: supportRequests,
    },
  });
});

router.post("/support/requests", async (req, res): Promise<void> => {
  const userId = userIdFrom(req);
  const category = typeof req.body?.category === "string" ? req.body.category : "";
  const subject = typeof req.body?.subject === "string" ? req.body.subject.trim().slice(0, 120) : "";
  const message = typeof req.body?.message === "string" ? req.body.message.trim().slice(0, 4000) : "";
  const validCategories = ["account", "privacy", "billing", "technical", "other"];

  if (!validCategories.includes(category) || !subject || !message) {
    res.status(400).json({ error: "Category, subject and message are required" });
    return;
  }

  const [request] = await db.insert(supportRequestsTable).values({
    userId,
    category,
    subject,
    message,
  }).returning();
  res.status(201).json(supportResponse(request));
});

router.get("/support/requests", async (req, res): Promise<void> => {
  const requests = await db.select().from(supportRequestsTable)
    .where(eq(supportRequestsTable.userId, userIdFrom(req)))
    .orderBy(desc(supportRequestsTable.createdAt));
  res.json(requests.map(supportResponse));
});

export default router;