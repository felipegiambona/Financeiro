import { index, integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cardsTable = pgTable("finance_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  profileId: uuid("profile_id"),
  name: text("name").notNull(),
  dueDay: integer("due_day").notNull(),
  closingDay: integer("closing_day").notNull(),
  currentInvoiceAmount: numeric("current_invoice_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  availableLimit: numeric("available_limit", { precision: 14, scale: 2 }),
  invoiceStatus: text("invoice_status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("finance_cards_user_id_idx").on(table.userId),
]);

export const insertCardSchema = createInsertSchema(cardsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCard = z.infer<typeof insertCardSchema>;
export type StoredCard = typeof cardsTable.$inferSelect;