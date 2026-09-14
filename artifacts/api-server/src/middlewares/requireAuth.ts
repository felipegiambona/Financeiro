import { getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import {
  cardsTable,
  categoriesTable,
  db,
  financialProfilesTable,
  goalMovementsTable,
  goalsTable,
  limitsTable,
  transactionsTable,
  walletsTable,
} from "@workspace/db";
import type { NextFunction, Request, Response } from "express";

export interface AuthenticatedRequest extends Request {
  userId: string;
  profileId?: string;
  profileType?: "personal" | "business";
  scopedUserId?: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as unknown as AuthenticatedRequest).userId = userId;
  next();
}

/**
 * Resolves the active financial profile and migrates legacy account-scoped
 * rows into the personal profile on first authenticated access.
 */
export async function resolveFinancialProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authenticated = req as AuthenticatedRequest;
  const userId = authenticated.userId;
  const requestedProfileId = req.header("x-financial-profile-id");

  let profile = requestedProfileId
    ? (await db.select().from(financialProfilesTable).where(and(
      eq(financialProfilesTable.id, requestedProfileId),
      eq(financialProfilesTable.userId, userId),
    )).limit(1))[0]
    : (await db.select().from(financialProfilesTable).where(and(
      eq(financialProfilesTable.userId, userId),
      eq(financialProfilesTable.type, "personal"),
    )).limit(1))[0];

  if (requestedProfileId && !profile) {
    res.status(403).json({ error: "Financial profile not found" });
    return;
  }

  if (!profile) {
    [profile] = await db.insert(financialProfilesTable).values({
      userId,
      type: "personal",
      name: "Pessoal",
    }).returning();
  }

  const scopedUserId = `${userId}::${profile.id}`;
  // Before profile support, financial rows were keyed only by Clerk userId.
  // Keep those rows in the personal profile and use the composite owner key
  // for legacy route predicates while the nullable column is backfilled.
  const legacyWhere = eq(transactionsTable.userId, userId);
  await db.transaction(async (tx) => {
    await tx.update(transactionsTable).set({ userId: scopedUserId, profileId: profile.id }).where(legacyWhere);
    await tx.update(walletsTable).set({ userId: scopedUserId, profileId: profile.id }).where(eq(walletsTable.userId, userId));
    await tx.update(categoriesTable).set({ userId: scopedUserId, profileId: profile.id }).where(eq(categoriesTable.userId, userId));
    await tx.update(limitsTable).set({ userId: scopedUserId, profileId: profile.id }).where(eq(limitsTable.userId, userId));
    await tx.update(goalsTable).set({ userId: scopedUserId, profileId: profile.id }).where(eq(goalsTable.userId, userId));
    await tx.update(goalMovementsTable).set({ userId: scopedUserId, profileId: profile.id }).where(eq(goalMovementsTable.userId, userId));
    await tx.update(cardsTable).set({ userId: scopedUserId, profileId: profile.id }).where(eq(cardsTable.userId, userId));
  });

  authenticated.profileId = profile.id;
  authenticated.profileType = profile.type;
  authenticated.scopedUserId = scopedUserId;
  next();
}

export function accountUserIdFrom(req: unknown): string {
  return (req as AuthenticatedRequest).userId;
}

export function profileIdFrom(req: unknown): string {
  const profileId = (req as AuthenticatedRequest).profileId;
  if (!profileId) throw new Error("Financial profile was not resolved");
  return profileId;
}

export function financialProfileTypeFrom(req: unknown): "personal" | "business" {
  const profileType = (req as AuthenticatedRequest).profileType;
  if (!profileType) throw new Error("Financial profile was not resolved");
  return profileType;
}

export function scopedUserIdFrom(req: unknown): string {
  const scopedUserId = (req as AuthenticatedRequest).scopedUserId;
  if (!scopedUserId) throw new Error("Financial profile was not resolved");
  return scopedUserId;
}