import { pgTable, text, serial, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roadsTable = pgTable("roads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  qualityScore: integer("quality_score").notNull().default(70),
  lastMaintained: text("last_maintained").notNull(),
  department: text("department").notNull(),
  contractorName: text("contractor_name").notNull(),
  tenderValue: real("tender_value"),
  estimatedLifespanYears: integer("estimated_lifespan_years").notNull().default(10),
  latitude: real("latitude"),
  longitude: real("longitude"),
});

export const insertRoadSchema = createInsertSchema(roadsTable).omit({ id: true });
export type InsertRoad = z.infer<typeof insertRoadSchema>;
export type Road = typeof roadsTable.$inferSelect;
