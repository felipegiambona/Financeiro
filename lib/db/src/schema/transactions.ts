import { boolean, index, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const transactionsTable = pgTable("finance_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  profileId: uuid("profile_id"),
  walletId: uuid("wallet_id"),
  cardId: uuid("card_id"),
  cardEntryType: text("card_entry_type").notNull().default("purchase"),
  destinationWalletId: uuid("destination_wallet_id"),
  categoryId: uuid("category_id"),
  goalId: uuid("goal_id"),
  type: text("type").notNull(),
  isInvestment: boolean("is_investment").notNull().default(false),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  description: text("description").notNull(),
  date: text("date").notNull(),
  dueDate: text("due_date"),
  recurrence: jsonb("recurrence").notNull(),
  paymentStatus: text("payment_status").notNull(),
  paymentStatusOverrides: jsonb("payment_status_overrides").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("finance_transactions_user_id_idx").on(table.userId),
  index("finance_transactions_wallet_id_idx").on(table.walletId),
  index("finance_transactions_card_id_idx").on(table.cardId),
]);

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type StoredTransaction = typeof transactionsTable.$inferSelect;