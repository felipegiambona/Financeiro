import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const financialProfileType = pgEnum("financial_profile_type", ["personal", "business"]);

export const financialProfilesTable = pgTable("financial_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  type: financialProfileType("type").notNull(),
  name: text("name").notNull(),
  businessName: text("business_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("financial_profiles_user_id_idx").on(table.userId),
]);

export const insertFinancialProfileSchema = createInsertSchema(financialProfilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFinancialProfile = z.infer<typeof insertFinancialProfileSchema>;
export type StoredFinancialProfile = typeof financialProfilesTable.$inferSelect;