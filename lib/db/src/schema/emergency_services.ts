import { pgTable, text, serial, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const emergencyServicesTable = pgTable("emergency_services", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  phone: text("phone").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  address: text("address").notNull(),
  isAvailable: boolean("is_available").notNull().default(true),
});

export const insertEmergencyServiceSchema = createInsertSchema(emergencyServicesTable).omit({ id: true });
export type InsertEmergencyService = z.infer<typeof insertEmergencyServiceSchema>;
export type EmergencyService = typeof emergencyServicesTable.$inferSelect;
