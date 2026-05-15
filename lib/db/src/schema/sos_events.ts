import { pgTable, text, serial, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sosEventsTable = pgTable("sos_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  description: text("description"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSosEventSchema = createInsertSchema(sosEventsTable).omit({ id: true, createdAt: true });
export type InsertSosEvent = z.infer<typeof insertSosEventSchema>;
export type SosEvent = typeof sosEventsTable.$inferSelect;
