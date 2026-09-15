import { date, index, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const investmentDividendType = pgEnum("investment_dividend_type", [
  "dividend",
  "jcp",
]);

export const investmentDividendStatus = pgEnum("investment_dividend_status", [
  "expected",
  "received",
]);

export const investmentDividendsTable = pgTable("finance_investment_dividends", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  profileId: uuid("profile_id").notNull(),
  investmentId: uuid("investment_id").notNull(),
  type: investmentDividendType("type").notNull(),
  amount: numeric("amount", { precision: 16, scale: 2 }).notNull(),
  paymentDate: date("payment_date", { mode: "string" }).notNull(),
  status: investmentDividendStatus("status").notNull().default("expected"),
  note: text("note"),
  transactionId: uuid("transaction_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("finance_investment_dividends_user_id_idx").on(table.userId),
  index("finance_investment_dividends_profile_id_idx").on(table.profileId),
  index("finance_investment_dividends_investment_id_idx").on(table.investmentId),
  uniqueIndex("finance_investment_dividends_transaction_id_idx").on(table.transactionId),
]);

export const insertInvestmentDividendSchema = createInsertSchema(investmentDividendsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInvestmentDividend = z.infer<typeof insertInvestmentDividendSchema>;
export type StoredInvestmentDividend = typeof investmentDividendsTable.$inferSelect;