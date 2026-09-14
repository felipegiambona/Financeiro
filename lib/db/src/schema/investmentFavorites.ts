import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { investmentAssetType } from "./investments";

export const investmentFavoritesTable = pgTable("finance_investment_favorites", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  profileId: uuid("profile_id").notNull(),
  name: text("name").notNull(),
  ticker: text("ticker").notNull().default(""),
  assetType: investmentAssetType("asset_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("finance_investment_favorites_user_id_idx").on(table.userId),
  index("finance_investment_favorites_profile_id_idx").on(table.profileId),
  uniqueIndex("finance_investment_favorites_profile_asset_idx").on(table.profileId, table.assetType, table.ticker, table.name),
]);

export const insertInvestmentFavoriteSchema = createInsertSchema(investmentFavoritesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInvestmentFavorite = z.infer<typeof insertInvestmentFavoriteSchema>;
export type StoredInvestmentFavorite = typeof investmentFavoritesTable.$inferSelect;