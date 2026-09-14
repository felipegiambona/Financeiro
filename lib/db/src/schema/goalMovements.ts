import { index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const goalMovementsTable = pgTable("finance_goal_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  profileId: uuid("profile_id"),
  goalId: uuid("goal_id").notNull(),
  type: text("type").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  description: text("description").notNull(),
  date: text("date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("finance_goal_movements_user_id_idx").on(table.userId),
  index("finance_goal_movements_goal_id_idx").on(table.goalId),
]);

export const insertGoalMovementSchema = createInsertSchema(goalMovementsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertGoalMovement = z.infer<typeof insertGoalMovementSchema>;
export type StoredGoalMovement = typeof goalMovementsTable.$inferSelect;