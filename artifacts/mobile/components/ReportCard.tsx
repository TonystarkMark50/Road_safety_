import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface Report {
  id: number;
  ticketId: string;
  title: string;
  category: string;
  status: string;
  severity: string;
  address: string;
  upvotes: number;
  createdAt: string;
}

interface ReportCardProps {
  report: Report;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  submitted: { label: "Submitted", color: "#7a8499" },
  under_review: { label: "Under Review", color: "#f59e0b" },
  assigned: { label: "Assigned", color: "#4ba8f7" },
  in_progress: { label: "In Progress", color: "#a855f7" },
  resolved: { label: "Resolved", color: "#22c55e" },
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "#22c55e" },
  medium: { label: "Medium", color: "#f59e0b" },
  high: { label: "High", color: "#f97316" },
  critical: { label: "Critical", color: "#ef4444" },
};

const CATEGORY_ICONS: Record<string, string> = {
  pothole: "alert-circle",
  road_damage: "tool",
  accident: "alert-triangle",
  waterlogging: "droplet",
  signal_failure: "alert-octagon",
  illegal_parking: "slash",
  congestion: "activity",
  other: "help-circle",
};

function formatCategory(cat: string) {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function ReportCard({ report }: ReportCardProps) {
  const colors = useColors();
  const status = STATUS_CONFIG[report.status] ?? { label: report.status, color: "#7a8499" };
  const severity = SEVERITY_CONFIG[report.severity] ?? { label: report.severity, color: "#7a8499" };
  const iconName = (CATEGORY_ICONS[report.category] ?? "help-circle") as React.ComponentProps<typeof Feather>["name"];

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/report/${report.id}`)}
      activeOpacity={0.75}
    >
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
          <Feather name={iconName} size={18} color={colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {report.title}
          </Text>
          <Text style={[styles.ticket, { color: colors.mutedForeground }]}>#{report.ticketId}</Text>
        </View>
        <View style={[styles.severityBadge, { backgroundColor: severity.color + "22" }]}>
          <Text style={[styles.severityText, { color: severity.color }]}>{severity.label}</Text>
        </View>
      </View>

      <View style={styles.meta}>
        <Feather name="map-pin" size={12} color={colors.mutedForeground} />
        <Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
          {report.address}
        </Text>
      </View>

      <View style={styles.footer}>
        <View style={[styles.statusBadge, { backgroundColor: status.color + "22" }]}>
          <View style={[styles.statusDot, { backgroundColor: status.color }]} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
        <Text style={[styles.category, { color: colors.mutedForeground }]}>
          {formatCategory(report.category)}
        </Text>
        <View style={styles.upvotes}>
          <Feather name="thumbs-up" size={12} color={colors.mutedForeground} />
          <Text style={[styles.upvoteText, { color: colors.mutedForeground }]}>{report.upvotes}</Text>
        </View>
        <Text style={[styles.time, { color: colors.mutedForeground }]}>{timeAgo(report.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  ticket: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  severityText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  category: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  upvotes: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  upvoteText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  time: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
