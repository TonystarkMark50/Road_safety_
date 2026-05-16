import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { eq, asc } from "drizzle-orm";
import { getAuth } from "@clerk/express";

const router = Router();

const SYSTEM_PROMPT = `You are RoadBot, an AI assistant for RoadSoS AI — a civic safety and infrastructure transparency platform in India.

Your role is to help citizens:
- Report road hazards (potholes, damaged roads, accidents, flooding, poor lighting, illegal encroachments)
- Understand how to use the platform (submit reports, track status, upvote issues)
- Learn about emergency services (SOS, nearby hospitals, police, fire stations)
- Understand road transparency data (quality scores, maintenance history, contractors)
- Navigate budget and spending information for infrastructure projects
- Understand their reports' status and what happens next

Be concise, helpful, and empathetic. When someone describes a road problem, guide them to submit a report via the Reports section. For emergencies involving injury or immediate danger, always recommend the Emergency / SOS feature first.

Keep responses short and actionable (2-4 sentences max unless more detail is truly needed). Use simple language.`;

router.get("/openai/conversations", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Unauthorized" });

  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, auth.userId))
    .orderBy(asc(conversations.createdAt));

  res.json(rows);
});

router.post("/openai/conversations", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Unauthorized" });

  const { title } = req.body as { title: string };
  if (!title) return res.status(400).json({ error: "title is required" });

  const [row] = await db
    .insert(conversations)
    .values({ title, userId: auth.userId })
    .returning();

  res.status(201).json(row);
});

router.get("/openai/conversations/:id", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Unauthorized" });

  const id = Number(req.params.id);
  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id));

  if (!conv || conv.userId !== auth.userId) {
    return res.status(404).json({ error: "Not found" });
  }

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));

  res.json({ ...conv, messages: msgs });
});

router.delete("/openai/conversations/:id", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Unauthorized" });

  const id = Number(req.params.id);
  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id));

  if (!conv || conv.userId !== auth.userId) {
    return res.status(404).json({ error: "Not found" });
  }

  await db.delete(conversations).where(eq(conversations.id, id));
  res.status(204).end();
});

router.get("/openai/conversations/:id/messages", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Unauthorized" });

  const id = Number(req.params.id);
  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id));

  if (!conv || conv.userId !== auth.userId) {
    return res.status(404).json({ error: "Not found" });
  }

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));

  res.json(msgs);
});

router.post("/openai/conversations/:id/messages", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Unauthorized" });

  const id = Number(req.params.id);
  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id));

  if (!conv || conv.userId !== auth.userId) {
    return res.status(404).json({ error: "Not found" });
  }

  const { content } = req.body as { content: string };
  if (!content) return res.status(400).json({ error: "content is required" });

  await db.insert(messages).values({
    conversationId: id,
    role: "user",
    content,
  });

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));

  const chatMessages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 8192,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullResponse += delta;
        res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
    }

    await db.insert(messages).values({
      conversationId: id,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "OpenAI streaming error");
    res.write(`data: ${JSON.stringify({ error: "AI error" })}\n\n`);
    res.end();
  }
});

export default router;
