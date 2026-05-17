import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

/* ─── Constants ───────────────────────────────────────────────────── */

const CATEGORY_COLORS: Record<string, string> = {
  accident:        "#ef4444",
  pothole:         "#3b82f6",
  waterlogging:    "#22c55e",
  illegal_parking: "#a855f7",
  road_damage:     "#f97316",
  signal_failure:  "#eab308",
  congestion:      "#06b6d4",
  other:           "#9ca3af",
};

const CATEGORIES = [
  { value: "all",             label: "All" },
  { value: "pothole",         label: "Pothole" },
  { value: "road_damage",     label: "Road Damage" },
  { value: "accident",        label: "Accident" },
  { value: "waterlogging",    label: "Waterlogging" },
  { value: "signal_failure",  label: "Signal" },
  { value: "illegal_parking", label: "Illegal Parking" },
  { value: "congestion",      label: "Congestion" },
  { value: "other",           label: "Other" },
];

const SEVERITIES = [
  { value: "low",      label: "Low" },
  { value: "medium",   label: "Medium" },
  { value: "high",     label: "High" },
  { value: "critical", label: "Critical" },
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high:     "#f97316",
  medium:   "#eab308",
  low:      "#22c55e",
};

type Report = {
  id: number; ticketId: string; title: string; category: string;
  description: string; status: string; latitude: number | null;
  longitude: number | null; address: string; severity: string;
  upvotes: number; createdAt: string; userName?: string;
};

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN ?? ""}`;

async function fetchReports(): Promise<Report[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/reports?limit=100`, { credentials: "include" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.reports ?? [];
  } catch {
    return [];
  }
}

async function submitReport(body: object): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/reports`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function openInMaps(lat: number, lng: number, title: string) {
  const encoded = encodeURIComponent(title);
  const url =
    Platform.OS === "ios"
      ? `maps://?ll=${lat},${lng}&q=${encoded}`
      : `geo:${lat},${lng}?q=${encoded}`;
  Linking.openURL(url).catch(() =>
    Linking.openURL(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=16`)
  );
}

/* ─── Report Card ─────────────────────────────────────────────────── */

function ReportCard({ item, colors }: { item: Report; colors: ReturnType<typeof useColors> }) {
  const catColor = CATEGORY_COLORS[item.category] ?? "#9ca3af";
  const sevColor = SEVERITY_COLORS[item.severity] ?? "#6b7280";
  const canNavigate = !!item.latitude && !!item.longitude;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.catDot, { backgroundColor: catColor }]} />
        <View style={styles.cardTitleWrap}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[styles.cardAddress, { color: colors.mutedForeground }]} numberOfLines={1}>
            {item.address}
          </Text>
        </View>
        {canNavigate && (
          <TouchableOpacity
            style={[styles.navBtn, { backgroundColor: colors.primary + "18" }]}
            onPress={() => openInMaps(item.latitude!, item.longitude!, item.title)}
            activeOpacity={0.7}
          >
            <Feather name="navigation" size={13} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.cardBadges}>
        <View style={[styles.badge, { backgroundColor: catColor + "22" }]}>
          <Text style={[styles.badgeText, { color: catColor }]}>
            {item.category.replace("_", " ")}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: sevColor + "22" }]}>
          <Text style={[styles.badgeText, { color: sevColor }]}>{item.severity}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: colors.muted }]}>
          <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>
            {item.status.replace("_", " ")}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
          ▲ {item.upvotes}  ·  {timeAgo(item.createdAt)}
        </Text>
        <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
          {item.ticketId}
        </Text>
      </View>
    </View>
  );
}

/* ─── Report Form Modal ───────────────────────────────────────────── */

function ReportModal({
  visible, onClose, onSuccess, colors,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [form, setForm] = useState({
    title: "", category: "pothole", description: "",
    severity: "medium", latitude: "", longitude: "", address: "",
  });
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const insets = useSafeAreaInsets();

  function update(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function captureGPS() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Location access is needed to auto-fill coordinates.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      update("latitude", lat.toFixed(6));
      update("longitude", lng.toFixed(6));
      const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (geo.length > 0) {
        const g = geo[0];
        const addr = [g.name, g.street, g.district, g.city].filter(Boolean).join(", ");
        update("address", addr || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      }
    } catch {
      Alert.alert("Error", "Could not get location. Please enter manually.");
    } finally {
      setLocating(false);
    }
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.address.trim()) {
      Alert.alert("Missing fields", "Please fill in the title and location.");
      return;
    }
    setSubmitting(true);
    const ok = await submitReport({
      title: form.title,
      category: form.category,
      description: form.description || "No description provided.",
      severity: form.severity,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      address: form.address,
    });
    setSubmitting(false);
    if (ok) {
      setForm({ title: "", category: "pothole", description: "", severity: "medium", latitude: "", longitude: "", address: "" });
      onSuccess();
    } else {
      Alert.alert("Error", "Could not submit report. Please try again.");
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
        {/* Modal Header */}
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Report an Issue</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
          {/* Title */}
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Issue Title *</Text>
          <TextInput
            value={form.title}
            onChangeText={(v) => update("title", v)}
            placeholder="e.g. Large pothole on MG Road"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
          />

          {/* Category */}
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {CATEGORIES.slice(1).map((c) => {
              const active = form.category === c.value;
              const col = CATEGORY_COLORS[c.value] ?? "#9ca3af";
              return (
                <TouchableOpacity
                  key={c.value}
                  onPress={() => update("category", c.value)}
                  style={[styles.chip, {
                    backgroundColor: active ? col : colors.muted,
                    borderColor: active ? col : colors.border,
                  }]}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, { color: active ? "#fff" : colors.mutedForeground }]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Severity */}
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Severity</Text>
          <View style={styles.sevRow}>
            {SEVERITIES.map((s) => {
              const active = form.severity === s.value;
              const col = SEVERITY_COLORS[s.value];
              return (
                <TouchableOpacity
                  key={s.value}
                  onPress={() => update("severity", s.value)}
                  style={[styles.sevBtn, {
                    flex: 1,
                    backgroundColor: active ? col : colors.muted,
                    borderColor: active ? col : colors.border,
                  }]}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, { color: active ? "#fff" : colors.mutedForeground }]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Location */}
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Location *</Text>
          <View style={styles.locRow}>
            <TextInput
              value={form.address}
              onChangeText={(v) => update("address", v)}
              placeholder="Address or landmark"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, styles.locInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            />
            <TouchableOpacity
              onPress={captureGPS}
              disabled={locating}
              style={[styles.gpsBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              {locating
                ? <ActivityIndicator size="small" color="#fff" />
                : <Feather name="crosshair" size={16} color="#fff" />}
            </TouchableOpacity>
          </View>
          {form.latitude ? (
            <Text style={[styles.gpsCoords, { color: colors.mutedForeground }]}>
              📍 {parseFloat(form.latitude).toFixed(5)}, {parseFloat(form.longitude).toFixed(5)}
            </Text>
          ) : null}

          {/* Description */}
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Description</Text>
          <TextInput
            value={form.description}
            onChangeText={(v) => update("description", v)}
            placeholder="Describe the issue in detail…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
            style={[styles.input, styles.textArea, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
          />

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }]}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Feather name="send" size={16} color="#fff" />}
            <Text style={styles.submitBtnText}>
              {submitting ? "Submitting…" : "Submit Report"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ─── Main Map Screen ─────────────────────────────────────────────── */

export default function MapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterCat, setFilterCat] = useState("all");
  const [showFormModal, setShowFormModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const data = await fetchReports();
    setReports(data);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  const filtered = filterCat === "all"
    ? reports
    : reports.filter((r) => r.category === filterCat);

  const highPriority = reports.filter((r) => r.severity === "critical" || r.severity === "high");

  function handleSuccess() {
    setShowFormModal(false);
    setShowSuccess(true);
    setTimeout(() => { setShowSuccess(false); load(); }, 2500);
  }

  const ListHeader = (
    <View>
      {/* Success Banner */}
      {showSuccess && (
        <View style={[styles.successBanner, { backgroundColor: "#22c55e18", borderColor: "#22c55e44" }]}>
          <Feather name="check-circle" size={14} color="#22c55e" />
          <Text style={[styles.successText, { color: "#22c55e" }]}>
            Issue reported! It'll appear on the map shortly.
          </Text>
        </View>
      )}

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {CATEGORIES.map((c) => {
          const active = filterCat === c.value;
          const col = c.value === "all" ? colors.primary : (CATEGORY_COLORS[c.value] ?? colors.primary);
          return (
            <TouchableOpacity
              key={c.value}
              onPress={() => setFilterCat(c.value)}
              style={[styles.filterChip, {
                backgroundColor: active ? col : colors.muted,
                borderColor: active ? col : colors.border,
              }]}
              activeOpacity={0.75}
            >
              {c.value !== "all" && (
                <View style={[styles.filterDot, { backgroundColor: active ? "#fff" : CATEGORY_COLORS[c.value] ?? "#9ca3af" }]} />
              )}
              <Text style={[styles.filterChipText, { color: active ? "#fff" : colors.mutedForeground }]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* High Priority Section */}
      {highPriority.length > 0 && filterCat === "all" && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="alert-triangle" size={14} color="#ef4444" />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>High Priority</Text>
            <View style={[styles.countBadge, { backgroundColor: "#ef444422" }]}>
              <Text style={[styles.countBadgeText, { color: "#ef4444" }]}>{highPriority.length}</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {highPriority.slice(0, 6).map((r) => {
              const col = CATEGORY_COLORS[r.category] ?? "#9ca3af";
              const sev = SEVERITY_COLORS[r.severity] ?? "#6b7280";
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.priorityCard, { backgroundColor: colors.card, borderColor: sev + "55", borderLeftColor: sev }]}
                  activeOpacity={0.8}
                  onPress={() => r.latitude && r.longitude && openInMaps(r.latitude, r.longitude, r.title)}
                >
                  <View style={styles.priorityCardHeader}>
                    <View style={[styles.catDot, { backgroundColor: col }]} />
                    <Text style={[styles.priorityTitle, { color: colors.foreground }]} numberOfLines={2}>
                      {r.title}
                    </Text>
                  </View>
                  <Text style={[styles.priorityAddr, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {r.address.split(",")[0]}
                  </Text>
                  <View style={styles.priorityFooter}>
                    <Text style={[styles.prioritySev, { color: sev }]}>{r.severity}</Text>
                    {r.latitude && r.longitude && (
                      <View style={[styles.navBadge, { backgroundColor: colors.primary + "18" }]}>
                        <Feather name="navigation" size={10} color={colors.primary} />
                        <Text style={[styles.navBadgeText, { color: colors.primary }]}>Navigate</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* All Reports header */}
      <View style={[styles.sectionHeader, { paddingHorizontal: 16, marginTop: 12, marginBottom: 4 }]}>
        <Feather name="map-pin" size={14} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          {filterCat === "all" ? "All Reports" : CATEGORIES.find((c) => c.value === filterCat)?.label}
        </Text>
        <Text style={[styles.countBadgeText, { color: colors.mutedForeground, marginLeft: 4 }]}>
          ({filtered.length})
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Live Map</Text>
            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={[styles.liveText, { color: colors.mutedForeground }]}>
                {reports.length} reports · live
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.reportBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowFormModal(true)}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.reportBtnText}>Report</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Legend row */}
      <View style={[styles.legendRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {Object.entries(CATEGORY_COLORS).slice(0, 5).map(([cat, col]) => (
          <View key={cat} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: col }]} />
            <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
              {cat.replace("_", " ")}
            </Text>
          </View>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading reports…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <ReportCard item={item} colors={colors} />
            </View>
          )}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="map" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No reports yet in this category
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: bottomPad + 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Report Modal */}
      <ReportModal
        visible={showFormModal}
        onClose={() => setShowFormModal(false)}
        onSuccess={handleSuccess}
        colors={colors}
      />
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.4 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#22c55e" },
  liveText: { fontSize: 11 },
  reportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  reportBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 9, textTransform: "capitalize" },
  filterRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 7 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterDot: { width: 6, height: 6, borderRadius: 3 },
  filterChipText: { fontSize: 12, fontWeight: "500" },
  section: { marginBottom: 4 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: "600" },
  countBadge: {
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countBadgeText: { fontSize: 11, fontWeight: "700" },
  priorityCard: {
    width: 170,
    marginLeft: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  priorityCardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 4 },
  priorityTitle: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 16 },
  priorityAddr: { fontSize: 10, marginBottom: 8 },
  priorityFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  prioritySev: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  navBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  navBadgeText: { fontSize: 9, fontWeight: "600" },
  cardWrapper: { paddingHorizontal: 12, marginBottom: 8 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  catDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3, flexShrink: 0 },
  cardTitleWrap: { flex: 1 },
  cardTitle: { fontSize: 13, fontWeight: "600", marginBottom: 2 },
  cardAddress: { fontSize: 11 },
  navBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBadges: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginBottom: 8 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: { fontSize: 10, fontWeight: "600", textTransform: "capitalize" },
  cardFooter: { flexDirection: "row", justifyContent: "space-between" },
  cardMeta: { fontSize: 10 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14 },
  emptyContainer: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14 },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 4,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  successText: { fontSize: 12, fontWeight: "500", flex: 1 },
  // Modal
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  modalBody: { paddingHorizontal: 20 },
  label: { fontSize: 12, fontWeight: "500", marginTop: 16, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: { height: 80, textAlignVertical: "top", paddingTop: 10 },
  chipRow: { flexDirection: "row" as const },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 7,
  },
  chipText: { fontSize: 12, fontWeight: "500" },
  sevRow: { flexDirection: "row", gap: 7 },
  sevBtn: {
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  locRow: { flexDirection: "row", gap: 8 },
  locInput: { flex: 1 },
  gpsBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  gpsCoords: { fontSize: 10, marginTop: 4 },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 24,
    marginBottom: 8,
  },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
