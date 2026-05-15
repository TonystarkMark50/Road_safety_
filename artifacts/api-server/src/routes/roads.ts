import { Router } from "express";
import { db, roadsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/roads", async (_req, res): Promise<void> => {
  const roads = await db.select().from(roadsTable);
  res.json(roads);
});

router.get("/roads/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [road] = await db.select().from(roadsTable).where(eq(roadsTable.id, id));
  if (!road) { res.status(404).json({ error: "Road not found" }); return; }
  res.json(road);
});

export default router;
