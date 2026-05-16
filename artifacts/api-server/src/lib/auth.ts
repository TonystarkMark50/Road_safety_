import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "roadsosai_salt").digest("hex");
}

export function generateToken(userId: number): string {
  return Buffer.from(`${userId}:${Date.now()}:roadsosai_secret`).toString("base64");
}

export function parseToken(token: string): number | null {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const [userId] = decoded.split(":");
    const id = parseInt(userId, 10);
    return isNaN(id) ? null : id;
  } catch {
    return null;
  }
}

async function getOrProvisionUser(clerkUserId: string): Promise<typeof usersTable.$inferSelect | null> {
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkUserId));
  if (existing) return existing;
  return null;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = getAuth(req);

  if (auth?.userId) {
    const user = await getOrProvisionUser(auth.userId);
    if (user) {
      (req as any).user = user;
      return next();
    }
    res.status(401).json({ error: "User not provisioned. Please call /api/auth/sync first." });
    return;
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const userId = parseToken(token);
    if (userId) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
      if (user) {
        (req as any).user = user;
        return next();
      }
    }
  }

  res.status(401).json({ error: "Unauthorized" });
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const auth = getAuth(req);

  if (auth?.userId) {
    const user = await getOrProvisionUser(auth.userId);
    if (user) {
      (req as any).user = user;
    }
    return next();
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const userId = parseToken(token);
    if (userId) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
      if (user) {
        (req as any).user = user;
      }
    }
  }

  next();
}
