import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const privacyConsentsTable = pgTable("privacy_consents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  documentKey: text("document_key").notNull(),
  documentVersion: text("document_version").notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (table) => [
  index("privacy_consents_user_id_idx").on(table.userId),
  index("privacy_consents_document_idx").on(table.userId, table.documentKey),
]);

export const privacyRequestsTable = pgTable("privacy_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  profileId: uuid("profile_id"),
  requestType: text("request_type").notNull(),
  status: text("status").notNull().default("pending"),
  details: text("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  index("privacy_requests_user_id_idx").on(table.userId),
  index("privacy_requests_status_idx").on(table.status),
]);

export const supportRequestsTable = pgTable("support_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  category: text("category").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("support_requests_user_id_idx").on(table.userId),
  index("support_requests_status_idx").on(table.status),
]);

export const insertPrivacyRequestSchema = createInsertSchema(privacyRequestsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});
export type InsertPrivacyRequest = z.infer<typeof insertPrivacyRequestSchema>;
export type StoredPrivacyRequest = typeof privacyRequestsTable.$inferSelect;

export const insertSupportRequestSchema = createInsertSchema(supportRequestsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSupportRequest = z.infer<typeof insertSupportRequestSchema>;
export type StoredSupportRequest = typeof supportRequestsTable.$inferSelect;