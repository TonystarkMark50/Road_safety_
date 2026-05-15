import { Router } from "express";
import { db, budgetProjectsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/budget/overview", async (_req, res): Promise<void> => {
  const [totals] = await db.select({
    totalSanctioned: sql<number>`coalesce(sum(sanctioned_amount), 0)`,
    totalSpent: sql<number>`coalesce(sum(spent_amount), 0)`,
    projectCount: sql<number>`count(*)::int`,
    completedProjects: sql<number>`sum(case when status = 'completed' then 1 else 0 end)::int`,
  }).from(budgetProjectsTable);

  const sanctioned = totals.totalSanctioned || 0;
  const spent = totals.totalSpent || 0;
  res.json({
    totalSanctioned: sanctioned,
    totalSpent: spent,
    totalRemaining: sanctioned - spent,
    projectCount: totals.projectCount || 0,
    completedProjects: totals.completedProjects || 0,
    utilizationRate: sanctioned > 0 ? Math.round((spent / sanctioned) * 1000) / 10 : 0,
  });
});

router.get("/budget/projects", async (_req, res): Promise<void> => {
  const projects = await db.select().from(budgetProjectsTable);
  res.json(projects);
});

export default router;
