import { Feather } from "@expo/vector-icons";
import { useGetReport, useUpvoteReport } from "@workspace/api-client-react";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const STATUS_CONFIG: Record<string, { label: string; color: string; step: number }> = {
  submitted: { label: "Submitted", color: "#7a8499", step: 0 },
  under_review: { label: "Under Review", color: "#f59e0b", step: 1 },
  assigned: { label: "Assigned", color: "#4ba8f7", step: 2 },
  in_progress: { label: "In Progress", color: "#a855f7", step: 3 },
  resolved: { label: "Resolved", color: "#22c55e", step: 4 },
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "#22c55e" },
  medium: { label: "Medium", color: "#f59e0b" },
  high: { label: "High", color: "#f97316" },
  critical: { label: "Critical", color: "#ef4444" },
};

function formatDate(str: string) {
  return new Date(str).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCategory(cat: string) {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ReportDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: report, isLoading, refetch } = useGetReport(Number(id));
  const upvoteMutation = useUpvoteReport();

  async function handleUpvote() {
    if (!report) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await upvoteMutation.mutateAsync({ id: report.id });
    refetch();
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, flex: 1 }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!report) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, flex: 1 }]}>
        <Feather name="alert-circle" size={32} color={colors.mutedForeground} />
        <Text style={[styles.errorText, { color: colors.mutedForeground }]}>Report not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backLink, { color: colors.primary }]}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const status = STATUS_CONFIG[report.status] ?? { label: report.status, color: colors.mutedForeground, step: 0 };
  const severity = SEVERITY_CONFIG[report.severity] ?? { label: report.severity, color: colors.mutedForeground };
  const steps = ["Submitted", "Under Review", "Assigned", "In Progress", "Resolved"];

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.navHeader, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.foreground }]} numberOfLines={1}>
          {report.ticketId}
        </Text>
        <TouchableOpacity onPress={handleUpvote} style={styles.upvoteBtn} disabled={upvoteMutation.isPending}>
          <Feather name="thumbs-up" size={18} color={colors.primary} />
          <Text style={[styles.upvoteCount, { color: colors.primary }]}>{report.upvotes}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 32 },
        ]}
      >
        <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>{report.title}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: status.color + "20" }]}>
              <View style={[styles.dot, { backgroundColor: status.color }]} />
              <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: severity.color + "20" }]}>
              <Text style={[styles.badgeText, { color: severity.color }]}>{severity.label}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.muted }]}>
              <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>
                {formatCategory(report.category)}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Progress</Text>
          <View style={styles.progressSteps}>
            {steps.map((step, idx) => {
              const done = idx <= status.step;
              const active = idx === status.step;
              return (
                <View key={step} style={styles.stepWrap}>
                  <View
                    style={[
                      styles.stepCircle,
                      {
                        backgroundColor: done ? status.color : colors.muted,
                        borderColor: done ? status.color : colors.border,
                      },
                    ]}
                  >
                    {done ? (
                      <Feather name="check" size={10} color="#fff" />
                    ) : null}
                  </View>
                  {idx < steps.length - 1 && (
                    <View style={[styles.stepLine, { backgroundColor: idx < status.step ? status.color : colors.border }]} />
                  )}
                  <Text
                    style={[
                      styles.stepLabel,
                      { color: active ? status.color : done ? colors.mutedForeground : colors.border },
                    ]}
                    numberOfLines={2}
                  >
                    {step}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Details</Text>
          <Text style={[styles.description, { color: colors.foreground }]}>{report.description}</Text>

          {[
            { icon: "map-pin" as const, label: "Address", value: report.address },
            { icon: "calendar" as const, label: "Reported", value: formatDate(report.createdAt) },
            report.userName ? { icon: "user" as const, label: "Reported By", value: report.userName } : null,
            report.assignedTo ? { icon: "briefcase" as const, label: "Assigned To", value: report.assignedTo } : null,
            report.resolvedAt ? { icon: "check-circle" as const, label: "Resolved At", value: formatDate(report.resolvedAt) } : null,
          ]
            .filter(Boolean)
            .map((item) => item && (
              <View key={item.label} style={styles.detailRow}>
                <View style={[styles.detailIcon, { backgroundColor: colors.muted }]}>
                  <Feather name={item.icon} size={14} color={colors.primary} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
                  <Text style={[styles.detailValue, { color: colors.foreground }]}>{item.value}</Text>
                </View>
              </View>
            ))}
        </View>

        {report.adminNote ? (
          <View style={[styles.noteCard, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
            <Feather name="message-circle" size={16} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.noteLabel, { color: colors.primary }]}>Admin Note</Text>
              <Text style={[styles.noteText, { color: colors.foreground }]}>{report.adminNote}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  errorText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  backLink: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  navHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    flex: 1,
    textAlign: "center",
  },
  upvoteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    width: 60,
    justifyContent: "flex-end",
  },
  upvoteCount: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  container: {
    padding: 16,
    gap: 12,
  },
  headerCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    lineHeight: 24,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  progressCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  progressSteps: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  stepWrap: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  stepCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLine: {
    position: "absolute",
    top: 11,
    left: "50%",
    right: "-50%",
    height: 2,
    zIndex: -1,
  },
  stepLabel: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    lineHeight: 12,
  },
  detailCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  description: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  detailContent: { flex: 1 },
  detailLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  detailValue: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    lineHeight: 20,
  },
  noteCard: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  noteLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  noteText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
});
