import { index, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const investmentAssetType = pgEnum("investment_asset_type", [
  "stock",
  "fii",
  "etf",
  "fund",
  "fixed_income",
  "crypto",
  "other",
]);

export const investmentsTable = pgTable("finance_investments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  profileId: uuid("profile_id").notNull(),
  name: text("name").notNull(),
  ticker: text("ticker"),
  assetType: investmentAssetType("asset_type").notNull(),
  institution: text("institution"),
  quantity: numeric("quantity", { precision: 20, scale: 8 }).notNull(),
  averagePrice: numeric("average_price", { precision: 20, scale: 8 }).notNull(),
  investedAmount: numeric("invested_amount", { precision: 16, scale: 2 }).notNull(),
  currentValue: numeric("current_value", { precision: 16, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("finance_investments_user_id_idx").on(table.userId),
  index("finance_investments_profile_id_idx").on(table.profileId),
]);

export const insertInvestmentSchema = createInsertSchema(investmentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInvestment = z.infer<typeof insertInvestmentSchema>;
export type StoredInvestment = typeof investmentsTable.$inferSelect;