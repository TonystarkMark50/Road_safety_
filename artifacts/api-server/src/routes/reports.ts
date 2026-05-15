import { Router } from "express";
import { db, reportsTable, activityTable, notificationsTable, usersTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { authMiddleware, optionalAuth } from "../lib/auth";

const router = Router();

function generateTicketId(): string {
  const prefix = "RSI";
  const num = Math.floor(Math.random() * 900000) + 100000;
  return `${prefix}-${num}`;
}

router.get("/reports", async (req, res): Promise<void> => {
  const { status, category, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = Math.min(parseInt(limit, 10), 50);
  const offset = (pageNum - 1) * limitNum;

  const conditions: any[] = [];
  if (status && status !== "all") conditions.push(eq(reportsTable.status, status));
  if (category) conditions.push(eq(reportsTable.category, category));

  const baseQuery = db.select().from(reportsTable);
  const query = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

  const reports = await query.orderBy(desc(reportsTable.createdAt)).limit(limitNum).offset(offset);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(reportsTable);

  res.json({ reports, total: count, page: pageNum, limit: limitNum });
});

router.post("/reports", optionalAuth as any, async (req, res): Promise<void> => {
  const { title, category, description, latitude, longitude, address, severity = "medium", imageUrl } = req.body;
  if (!title || !category || !description || latitude == null || longitude == null || !address) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const user = (req as any).user;
  const [report] = await db.insert(reportsTable).values({
    ticketId: generateTicketId(),
    title,
    category,
    description,
    status: "submitted",
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    address,
    severity,
    imageUrl: imageUrl ?? null,
    userId: user?.id ?? null,
    userName: user?.name ?? "Anonymous",
  }).returning();

  if (user) {
    await db.update(usersTable).set({ reportsCount: sql`${usersTable.reportsCount} + 1` }).where(eq(usersTable.id, user.id));
    await db.insert(notificationsTable).values({
      userId: user.id,
      title: "Report Submitted",
      message: `Your report "${title}" has been submitted with ticket ID ${report.ticketId}`,
      type: "report_update",
      reportId: report.id,
    });
  }

  await db.insert(activityTable).values({
    type: "report_created",
    message: `New ${category.replace("_", " ")} report filed at ${address}`,
    userName: user?.name ?? "Anonymous",
    reportId: report.id,
  });

  res.status(201).json(report);
});

router.get("/reports/my", authMiddleware as any, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const reports = await db.select().from(reportsTable)
    .where(eq(reportsTable.userId, user.id))
    .orderBy(desc(reportsTable.createdAt));
  res.json(reports);
});

router.get("/reports/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [report] = await db.select().from(reportsTable).where(eq(reportsTable.id, id));
  if (!report) { res.status(404).json({ error: "Report not found" }); return; }
  res.json(report);
});

router.patch("/reports/:id", authMiddleware as any, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { status, assignedTo, adminNote } = req.body;
  const updates: any = { updatedAt: new Date() };
  if (status) updates.status = status;
  if (assignedTo !== undefined) updates.assignedTo = assignedTo;
  if (adminNote !== undefined) updates.adminNote = adminNote;
  if (status === "resolved") updates.resolvedAt = new Date();

  const [report] = await db.update(reportsTable).set(updates).where(eq(reportsTable.id, id)).returning();
  if (!report) { res.status(404).json({ error: "Report not found" }); return; }

  if (status && report.userId) {
    await db.insert(notificationsTable).values({
      userId: report.userId,
      title: "Report Status Updated",
      message: `Your report "${report.title}" status changed to ${status.replace("_", " ")}`,
      type: "report_update",
      reportId: report.id,
    });
    if (status === "resolved") {
      await db.insert(activityTable).values({
        type: "report_resolved",
        message: `Report "${report.title}" has been resolved`,
        reportId: report.id,
      });
    }
  }

  res.json(report);
});

router.post("/reports/:id/upvote", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [report] = await db.update(reportsTable)
    .set({ upvotes: sql`${reportsTable.upvotes} + 1` })
    .where(eq(reportsTable.id, id))
    .returning();
  if (!report) { res.status(404).json({ error: "Report not found" }); return; }

  await db.insert(activityTable).values({
    type: "report_upvoted",
    message: `Report "${report.title}" received community support`,
    reportId: report.id,
  });
  res.json(report);
});

export default router;
