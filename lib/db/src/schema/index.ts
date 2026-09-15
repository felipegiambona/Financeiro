// Export your models here. Add one export per file
// export * from "./posts";
//
// Each model/table should ideally be split into different files.
// Each model/table should define a Drizzle table, insert schema, and types:
//
//   import { pgTable, text, serial } from "drizzle-orm/pg-core";
//   import { createInsertSchema } from "drizzle-zod";
//   import { z } from "zod/v4";
//
//   export const postsTable = pgTable("posts", {
//     id: serial("id").primaryKey(),
//     title: text("title").notNull(),
//   });
//
//   export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true });
//   export type InsertPost = z.infer<typeof insertPostSchema>;
//   export type Post = typeof postsTable.$inferSelect;

import {
  assertFinancialEntityScopeContract,
  financialEntityTables,
} from "./financialEntities";
import { cardsTable } from "./cards";
import { categoriesTable } from "./categories";
import { goalMovementsTable } from "./goalMovements";
import { goalsTable } from "./goals";
import { investmentsTable } from "./investments";
import { investmentFavoritesTable } from "./investmentFavorites";
import { limitsTable } from "./limits";
import { transactionsTable } from "./transactions";
import { walletsTable } from "./wallets";

export * from "./transactions";
export * from "./wallets";
export * from "./categories";
export * from "./limits";
export * from "./goals";
export * from "./goalMovements";
export * from "./cards";
export * from "./financialProfiles";
export * from "./investments";
export * from "./investmentFavorites";
export * from "./financialEntities";
export * from "./privacy";

/**
 * All profile-scoped financial tables exported by this schema barrel.
 *
 * Keep this list in sync when adding a new finance_* table so the cleanup
 * registry fails fast if its scope contract is incomplete.
 */
export const financialSchemaTables = [
  { name: "finance_transactions", table: transactionsTable },
  { name: "finance_goal_movements", table: goalMovementsTable },
  { name: "finance_limits", table: limitsTable },
  { name: "finance_goals", table: goalsTable },
  { name: "finance_cards", table: cardsTable },
  { name: "finance_investments", table: investmentsTable },
  { name: "finance_investment_favorites", table: investmentFavoritesTable },
  { name: "finance_categories", table: categoriesTable },
  { name: "finance_wallets", table: walletsTable },
] as const;

assertFinancialEntityScopeContract(financialSchemaTables, financialEntityTables);