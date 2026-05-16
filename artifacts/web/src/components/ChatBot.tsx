import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Trash2, Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface Message {
  id?: number;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface Conversation {
  id: number;
  title: string;
  createdAt: string;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res;
}

export default function ChatBot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [showConvList, setShowConvList] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open && user) loadConversations();
  }, [open, user]);

  async function loadConversations() {
    try {
      const res = await apiFetch("/api/openai/conversations");
      const data: Conversation[] = await res.json();
      setConversations(data);
      if (data.length > 0 && !activeConvId) {
        await loadConversation(data[data.length - 1].id);
      } else if (data.length === 0) {
        await createConversation();
      }
    } catch { /* ignore */ }
  }

  async function loadConversation(id: number) {
    try {
      const res = await apiFetch(`/api/openai/conversations/${id}`);
      const data = await res.json();
      setActiveConvId(id);
      setMessages(data.messages ?? []);
      setShowConvList(false);
    } catch { /* ignore */ }
  }

  async function createConversation() {
    try {
      const res = await apiFetch("/api/openai/conversations", {
        method: "POST",
        body: JSON.stringify({ title: `Chat ${new Date().toLocaleDateString()}` }),
      });
      const conv: Conversation = await res.json();
      setConversations((prev) => [...prev, conv]);
      setActiveConvId(conv.id);
      setMessages([]);
      setShowConvList(false);
    } catch { /* ignore */ }
  }

  async function deleteConversation(id: number) {
    try {
      await apiFetch(`/api/openai/conversations/${id}`, { method: "DELETE" });
      const remaining = conversations.filter((c) => c.id !== id);
      setConversations(remaining);
      if (activeConvId === id) {
        if (remaining.length > 0) {
          await loadConversation(remaining[remaining.length - 1].id);
        } else {
          setActiveConvId(null);
          setMessages([]);
          await createConversation();
        }
      }
    } catch { /* ignore */ }
  }

  async function sendMessage() {
    if (!input.trim() || streaming || !activeConvId) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    const assistantMsg: Message = { role: "assistant", content: "", streaming: true };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    const text = input.trim();
    setInput("");
    setStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(`${BASE}/api/openai/conversations/${activeConvId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const json = JSON.parse(line.slice(6));
            if (json.content) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.streaming) {
                  updated[updated.length - 1] = { ...last, content: last.content + json.content };
                }
                return updated;
              });
            }
            if (json.done) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.streaming) {
                  updated[updated.length - 1] = { ...last, streaming: false };
                }
                return updated;
              });
            }
          } catch { /* malformed SSE line */ }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.streaming) {
            updated[updated.length - 1] = {
              ...last,
              content: "Sorry, something went wrong. Please try again.",
              streaming: false,
            };
          }
          return updated;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  if (!user) return null;

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all duration-200 hover:scale-105"
        aria-label="Open RoadBot AI assistant"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] h-[520px] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">RoadBot</p>
              <p className="text-xs text-muted-foreground">AI Assistant</p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowConvList((s) => !s)}
                title="Conversation history"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${showConvList ? "rotate-180" : ""}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={createConversation}
                title="New conversation"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {showConvList && (
            <div className="border-b border-border bg-muted/30 max-h-40 overflow-y-auto">
              {conversations.length === 0 && (
                <p className="text-xs text-muted-foreground px-4 py-3">No conversations yet</p>
              )}
              {conversations.map((c) => (
                <div
                  key={c.id}
                  className={`flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-muted/50 transition-colors ${
                    activeConvId === c.id ? "bg-muted/60" : ""
                  }`}
                  onClick={() => loadConversation(c.id)}
                >
                  <span className="text-xs text-foreground flex-1 truncate">{c.title}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center gap-3 py-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Hi! I'm RoadBot</p>
                  <p className="text-xs text-muted-foreground mt-1">Ask me about reporting road hazards,<br/>emergency services, or using RoadSoS AI.</p>
                </div>
                <div className="flex flex-col gap-2 w-full mt-2">
                  {[
                    "How do I report a pothole?",
                    "How does the SOS feature work?",
                    "What is the road quality score?",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                      className="text-xs px-3 py-2 rounded-lg border border-border hover:bg-muted/50 text-left text-muted-foreground transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}
                >
                  {msg.content}
                  {msg.streaming && (
                    <span className="inline-flex gap-0.5 ml-1">
                      <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="px-4 py-3 border-t border-border bg-card/80 backdrop-blur-sm">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask RoadBot…"
                rows={1}
                disabled={streaming}
                className="flex-1 resize-none rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 max-h-24 overflow-y-auto"
                style={{ minHeight: "38px" }}
              />
              <Button
                size="icon"
                onClick={sendMessage}
                disabled={!input.trim() || streaming}
                className="h-9 w-9 shrink-0 rounded-xl"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
