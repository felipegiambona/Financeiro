import { index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const limitsTable = pgTable("finance_limits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  categoryId: uuid("category_id").notNull(),
  description: text("description"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  period: text("period").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("finance_limits_user_id_idx").on(table.userId),
  index("finance_limits_category_id_idx").on(table.categoryId),
]);

export const insertLimitSchema = createInsertSchema(limitsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLimit = z.infer<typeof insertLimitSchema>;
export type StoredLimit = typeof limitsTable.$inferSelect;