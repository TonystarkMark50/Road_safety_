import { Router } from "express";
import { db, emergencyServicesTable, sosEventsTable, activityTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function calcDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

router.get("/emergency/services", async (req, res): Promise<void> => {
  const { lat, lng, type } = req.query as Record<string, string>;
  let services = await db.select().from(emergencyServicesTable);
  if (type && type !== "all") {
    services = services.filter((s) => s.type === type);
  }
  const withDistance = services.map((s) => ({
    ...s,
    distanceKm:
      lat && lng
        ? Math.round(calcDistance(parseFloat(lat), parseFloat(lng), s.latitude, s.longitude) * 10) / 10
        : null,
  }));
  if (lat && lng) {
    withDistance.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
  }
  res.json(withDistance);
});

router.post("/emergency/sos", async (req, res): Promise<void> => {
  const { latitude, longitude, description, contactName, contactPhone } = req.body;
  if (latitude == null || longitude == null) {
    res.status(400).json({ error: "Latitude and longitude required" });
    return;
  }
  const [event] = await db.insert(sosEventsTable).values({
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    description: description ?? null,
    contactName: contactName ?? null,
    contactPhone: contactPhone ?? null,
    status: "active",
  }).returning();

  await db.insert(activityTable).values({
    type: "sos_triggered",
    message: `SOS alert triggered at coordinates ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
  });

  const allServices = await db.select().from(emergencyServicesTable).where(eq(emergencyServicesTable.isAvailable, true));
  const nearby = allServices
    .map((s) => ({
      ...s,
      distanceKm: Math.round(calcDistance(parseFloat(latitude), parseFloat(longitude), s.latitude, s.longitude) * 10) / 10,
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 5);

  res.status(201).json({
    id: event.id,
    status: "active",
    nearbyServices: nearby,
    message: `SOS alert sent! ${nearby.length} emergency services found nearby.`,
  });
});

export default router;
