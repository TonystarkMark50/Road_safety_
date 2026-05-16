import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, generateToken, authMiddleware } from "../lib/auth";

const router = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const { name, email, password, role, phone } = req.body;
  if (!name || !email || !password || !role) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const validRoles = ["citizen", "admin", "authority", "emergency"];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }
  const [user] = await db.insert(usersTable).values({
    name,
    email,
    passwordHash: hashPassword(password),
    phone: phone ?? null,
    role,
  }).returning();
  const token = generateToken(user.id);
  res.status(201).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isVerified: user.isVerified,
      reportsCount: user.reportsCount,
      createdAt: user.createdAt,
    },
    token,
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Missing email or password" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || !user.passwordHash || user.passwordHash !== hashPassword(password)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const token = generateToken(user.id);
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isVerified: user.isVerified,
      reportsCount: user.reportsCount,
      createdAt: user.createdAt,
    },
    token,
  });
});

router.post("/auth/sync", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { name, email, phone } = req.body;
  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const [existingByClerk] = await db.select().from(usersTable).where(eq(usersTable.clerkId, auth.userId));
  if (existingByClerk) {
    res.json({
      id: existingByClerk.id,
      name: existingByClerk.name,
      email: existingByClerk.email,
      phone: existingByClerk.phone,
      role: existingByClerk.role,
      isVerified: existingByClerk.isVerified,
      reportsCount: existingByClerk.reportsCount,
      createdAt: existingByClerk.createdAt,
    });
    return;
  }

  const [existingByEmail] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existingByEmail) {
    const [updated] = await db.update(usersTable)
      .set({ clerkId: auth.userId, isVerified: true })
      .where(eq(usersTable.id, existingByEmail.id))
      .returning();
    res.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      role: updated.role,
      isVerified: updated.isVerified,
      reportsCount: updated.reportsCount,
      createdAt: updated.createdAt,
    });
    return;
  }

  const [newUser] = await db.insert(usersTable).values({
    clerkId: auth.userId,
    name: name || email.split("@")[0],
    email,
    passwordHash: null,
    phone: phone ?? null,
    role: "citizen",
    isVerified: true,
  }).returning();

  res.status(201).json({
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    phone: newUser.phone,
    role: newUser.role,
    isVerified: newUser.isVerified,
    reportsCount: newUser.reportsCount,
    createdAt: newUser.createdAt,
  });
});

router.get("/auth/me", authMiddleware as any, async (req, res): Promise<void> => {
  const user = (req as any).user;
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isVerified: user.isVerified,
    reportsCount: user.reportsCount,
    createdAt: user.createdAt,
  });
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  res.json({ message: "Logged out successfully" });
});

export default router;
