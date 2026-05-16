import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
}

interface Conversation {
  id: number;
  title: string;
}

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

async function apiGet(path: string, token: string | null) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function apiPost(path: string, body: object, token: string | null) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

function streamMessage(
  url: string,
  body: object,
  token: string | null,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: () => void,
) {
  const xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

  let processed = 0;
  xhr.onprogress = () => {
    const raw = xhr.responseText.slice(processed);
    processed = xhr.responseText.length;
    const lines = raw.split("\n");
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const json = JSON.parse(line.slice(6));
        if (json.content) onChunk(json.content);
        if (json.done) onDone();
      } catch {}
    }
  };

  xhr.onerror = () => onError();
  xhr.onabort = () => {};
  xhr.send(JSON.stringify(body));
  return xhr;
}

const SUGGESTIONS = [
  "How do I report a pothole?",
  "How does the SOS feature work?",
  "What is the road quality score?",
];

export default function ChatBot() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isSignedIn, getToken } = useAuth();

  const [open, setOpen] = useState(false);
  const [convId, setConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const listRef = useRef<FlatList>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open && isSignedIn && !convId) {
      initConversation();
    }
  }, [open, isSignedIn]);

  async function initConversation() {
    try {
      const token = await getToken();
      const convs: Conversation[] = await apiGet("/api/openai/conversations", token);
      if (convs.length > 0) {
        const latest = convs[convs.length - 1];
        const data = await apiGet(`/api/openai/conversations/${latest.id}`, token);
        setConvId(latest.id);
        setMessages(
          (data.messages ?? []).map((m: { id: number; role: string; content: string }) => ({
            id: String(m.id),
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        );
      } else {
        const conv: Conversation = await apiPost(
          "/api/openai/conversations",
          { title: `Chat ${new Date().toLocaleDateString()}` },
          token,
        );
        setConvId(conv.id);
        setMessages([]);
      }
    } catch {}
  }

  async function newConversation() {
    try {
      const token = await getToken();
      const conv: Conversation = await apiPost(
        "/api/openai/conversations",
        { title: `Chat ${new Date().toLocaleDateString()}` },
        token,
      );
      setConvId(conv.id);
      setMessages([]);
    } catch {}
  }

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming || !convId) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content };
    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      loading: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setStreaming(true);

    const token = await getToken();
    const url = `${BASE_URL}/api/openai/conversations/${convId}/messages`;

    xhrRef.current = streamMessage(
      url,
      { content },
      token,
      (chunk) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.loading) {
            updated[updated.length - 1] = { ...last, content: last.content + chunk };
          }
          return updated;
        });
      },
      () => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.loading) {
            updated[updated.length - 1] = { ...last, loading: false };
          }
          return updated;
        });
        setStreaming(false);
      },
      () => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.loading) {
            updated[updated.length - 1] = {
              ...last,
              content: "Sorry, something went wrong. Please try again.",
              loading: false,
            };
          }
          return updated;
        });
        setStreaming(false);
      },
    );
  }

  if (!isSignedIn) return null;

  return (
    <>
      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: colors.primary,
            bottom: insets.bottom + (Platform.OS === "web" ? 90 : 90),
          },
        ]}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
      >
        <Feather name="message-circle" size={24} color={colors.primaryForeground} />
      </TouchableOpacity>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <KeyboardAvoidingView
          style={[styles.flex, { backgroundColor: colors.background }]}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <View
            style={[
              styles.header,
              {
                backgroundColor: colors.card,
                borderBottomColor: colors.border,
                paddingTop: insets.top + 12,
              },
            ]}
          >
            <View style={styles.headerLeft}>
              <View style={[styles.botIcon, { backgroundColor: colors.primary + "20" }]}>
                <Feather name="message-circle" size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  RoadBot
                </Text>
                <Text style={[styles.headerSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  AI Assistant
                </Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                onPress={newConversation}
                style={[styles.iconBtn, { backgroundColor: colors.muted }]}
              >
                <Feather name="plus" size={18} color={colors.foreground} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setOpen(false)}
                style={[styles.iconBtn, { backgroundColor: colors.muted }]}
              >
                <Feather name="x" size={18} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.messageList,
              messages.length === 0 && styles.emptyList,
            ]}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.primary + "15" }]}>
                  <Feather name="message-circle" size={32} color={colors.primary} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  Hi! I'm RoadBot
                </Text>
                <Text style={[styles.emptySub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Ask me about reporting hazards, emergency services, or using RoadSoS AI.
                </Text>
                <View style={styles.suggestions}>
                  {SUGGESTIONS.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.suggestionBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                      onPress={() => sendMessage(s)}
                    >
                      <Text style={[styles.suggestionText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            }
            renderItem={({ item }) => (
              <View
                style={[
                  styles.messageRow,
                  item.role === "user" ? styles.userRow : styles.botRow,
                ]}
              >
                <View
                  style={[
                    styles.bubble,
                    item.role === "user"
                      ? [styles.userBubble, { backgroundColor: colors.primary }]
                      : [styles.botBubble, { backgroundColor: colors.card, borderColor: colors.border }],
                  ]}
                >
                  {item.loading && item.content === "" ? (
                    <View style={styles.typingRow}>
                      <ActivityIndicator size="small" color={colors.mutedForeground} />
                      <Text style={[styles.typingText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        Thinking…
                      </Text>
                    </View>
                  ) : (
                    <Text
                      style={[
                        styles.bubbleText,
                        item.role === "user"
                          ? { color: colors.primaryForeground, fontFamily: "Inter_400Regular" }
                          : { color: colors.foreground, fontFamily: "Inter_400Regular" },
                      ]}
                    >
                      {item.content}
                      {item.loading ? " ▋" : ""}
                    </Text>
                  )}
                </View>
              </View>
            )}
          />

          <View
            style={[
              styles.inputBar,
              {
                backgroundColor: colors.card,
                borderTopColor: colors.border,
                paddingBottom: insets.bottom + 8,
              },
            ]}
          >
            <View style={[styles.inputWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <TextInput
                style={[styles.textInput, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                placeholder="Ask RoadBot…"
                placeholderTextColor={colors.mutedForeground}
                value={input}
                onChangeText={setInput}
                multiline
                editable={!streaming}
                onSubmitEditing={() => sendMessage()}
                returnKeyType="send"
                blurOnSubmit={false}
              />
            </View>
            <TouchableOpacity
              style={[
                styles.sendBtn,
                { backgroundColor: colors.primary },
                (!input.trim() || streaming) && styles.sendBtnDisabled,
              ]}
              onPress={() => sendMessage()}
              disabled={!input.trim() || streaming}
              activeOpacity={0.8}
            >
              <Feather name="send" size={18} color={colors.primaryForeground} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 100,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  botIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 16 },
  headerSub: { fontSize: 12 },
  headerRight: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  messageList: {
    padding: 16,
    gap: 8,
  },
  emptyList: { flex: 1 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 40,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 18 },
  emptySub: { fontSize: 14, textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },
  suggestions: { width: "100%", gap: 8, marginTop: 8 },
  suggestionBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  suggestionText: { fontSize: 13, textAlign: "center" },
  messageRow: { marginVertical: 2 },
  userRow: { alignItems: "flex-end" },
  botRow: { alignItems: "flex-start" },
  bubble: {
    maxWidth: "82%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: { borderBottomRightRadius: 4 },
  botBubble: { borderWidth: 1, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  typingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  typingText: { fontSize: 14 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  inputWrap: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 100,
  },
  textInput: { fontSize: 15, lineHeight: 20 },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
});
