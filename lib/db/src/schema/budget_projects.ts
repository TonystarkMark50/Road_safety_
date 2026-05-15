import { pgTable, text, serial, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const budgetProjectsTable = pgTable("budget_projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  department: text("department").notNull(),
  contractorName: text("contractor_name").notNull(),
  sanctionedAmount: real("sanctioned_amount").notNull(),
  spentAmount: real("spent_amount").notNull().default(0),
  status: text("status").notNull().default("planned"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
});

export const insertBudgetProjectSchema = createInsertSchema(budgetProjectsTable).omit({ id: true });
export type InsertBudgetProject = z.infer<typeof insertBudgetProjectSchema>;
export type BudgetProject = typeof budgetProjectsTable.$inferSelect;
