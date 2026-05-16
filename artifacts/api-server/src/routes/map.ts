import { Router } from "express";
import { optionalAuth } from "../lib/auth";
import { logger } from "../lib/logger";

const router = Router();
const ORS_KEY = process.env.OPENROUTESERVICE_API_KEY ?? "";
const ORS_BASE = "https://api.openrouteservice.org";

router.get("/map/geocode", optionalAuth, async (req, res): Promise<void> => {
  const { q } = req.query as Record<string, string>;
  if (!q) { res.status(400).json({ error: "Missing query parameter 'q'" }); return; }
  try {
    const url = `${ORS_BASE}/geocode/search?api_key=${ORS_KEY}&text=${encodeURIComponent(q)}&size=5`;
    const upstream = await fetch(url);
    const data = await upstream.json();
    res.json(data);
  } catch (err) {
    logger.error({ err }, "ORS geocode error");
    res.status(502).json({ error: "Geocoding service unavailable" });
  }
});

router.post("/map/directions", optionalAuth, async (req, res): Promise<void> => {
  const { start, end } = req.body as { start?: [number, number]; end?: [number, number] };
  if (!start || !end) { res.status(400).json({ error: "Missing start or end coordinates" }); return; }
  try {
    const url = `${ORS_BASE}/v2/directions/driving-car`;
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: ORS_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ coordinates: [start, end] }),
    });
    const data = await upstream.json();
    res.json(data);
  } catch (err) {
    logger.error({ err }, "ORS directions error");
    res.status(502).json({ error: "Directions service unavailable" });
  }
});

export default router;
