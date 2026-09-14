import { eq, like, or } from "drizzle-orm";
import { financialEntityTables, type db } from "@workspace/db";

type DatabaseExecutor = Pick<typeof db, "delete">;

export async function deleteFinancialRowsForProfile(
  tx: DatabaseExecutor,
  profileId: string,
  scopedUserId: string,
): Promise<void> {
  for (const { table } of financialEntityTables) {
    await tx.delete(table).where(or(
      eq(table.profileId, profileId),
      eq(table.userId, scopedUserId),
    ));
  }
}

export async function deleteFinancialRowsForAccount(
  tx: DatabaseExecutor,
  userId: string,
): Promise<void> {
  const scopedOwner = `${userId}::%`;

  for (const { table } of financialEntityTables) {
    await tx.delete(table).where(or(
      eq(table.userId, userId),
      like(table.userId, scopedOwner),
    ));
  }
}