import { Feather } from "@expo/vector-icons";
import {
  useGetDashboardSummary,
  useGetRecentActivity,
  useListReports,
} from "@workspace/api-client-react";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ReportCard } from "@/components/ReportCard";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

function timeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useGetDashboardSummary();
  const { data: activity, refetch: refetchActivity } = useGetRecentActivity();
  const {
    data: reportsData,
    isLoading: reportsLoading,
    refetch: refetchReports,
  } = useListReports({ status: "all", limit: 5 });

  const isLoading = summaryLoading || reportsLoading;

  async function handleRefresh() {
    await Promise.all([refetchSummary(), refetchActivity(), refetchReports()]);
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.container, { paddingTop: topPad + 12, paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 100 }]}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={colors.primary} />
      }
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            {user ? `Hello, ${user.name.split(" ")[0]}` : "Welcome to"}
          </Text>
          <Text style={[styles.appTitle, { color: colors.foreground }]}>RoadSoS AI</Text>
        </View>
        <TouchableOpacity
          style={[styles.sosBtn, { backgroundColor: colors.destructive }]}
          onPress={() => router.push("/(tabs)/emergency")}
          activeOpacity={0.8}
        >
          <Feather name="alert-triangle" size={18} color="#fff" />
          <Text style={styles.sosBtnText}>SOS</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.reportBanner, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" }]}
        onPress={() => router.push("/report/new")}
        activeOpacity={0.8}
      >
        <View style={[styles.reportBannerIcon, { backgroundColor: colors.primary + "20" }]}>
          <Feather name="plus-circle" size={22} color={colors.primary} />
        </View>
        <View style={styles.reportBannerText}>
          <Text style={[styles.reportBannerTitle, { color: colors.foreground }]}>
            Report a Road Issue
          </Text>
          <Text style={[styles.reportBannerSub, { color: colors.mutedForeground }]}>
            Tap to file a new complaint
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color={colors.primary} />
      </TouchableOpacity>

      {summaryLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : summary ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Platform Overview</Text>
          <View style={styles.statsRow}>
            <StatCard
              label="Total Reports"
              value={summary.totalReports}
              icon="file-text"
              color={colors.primary}
            />
            <StatCard
              label="Resolved"
              value={summary.resolvedReports}
              icon="check-circle"
              color={colors.success}
              subtitle={`${summary.resolutionRate.toFixed(0)}% rate`}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              label="In Progress"
              value={summary.inProgressReports ?? 0}
              icon="clock"
              color={colors.warning}
            />
            <StatCard
              label="Pending"
              value={summary.pendingReports}
              icon="alert-circle"
              color={colors.orange}
            />
          </View>
        </>
      ) : null}

      {activity && activity.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Activity</Text>
          <View style={[styles.activityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {activity.slice(0, 4).map((item, idx) => (
              <View key={item.id}>
                <View style={styles.activityItem}>
                  <View style={[styles.activityDot, { backgroundColor: colors.primary }]} />
                  <View style={styles.activityContent}>
                    <Text style={[styles.activityMsg, { color: colors.foreground }]} numberOfLines={2}>
                      {item.message}
                    </Text>
                    <Text style={[styles.activityTime, { color: colors.mutedForeground }]}>
                      {timeAgo(item.createdAt)}
                    </Text>
                  </View>
                </View>
                {idx < Math.min(activity.length, 4) - 1 && (
                  <View style={[styles.activityDivider, { backgroundColor: colors.border }]} />
                )}
              </View>
            ))}
          </View>
        </>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Latest Reports</Text>
        <TouchableOpacity onPress={() => router.push("/(tabs)/reports")}>
          <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
        </TouchableOpacity>
      </View>

      {reportsLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : reportsData?.reports?.length ? (
        reportsData.reports.slice(0, 5).map((r) => <ReportCard key={r.id} report={r} />)
      ) : (
        <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="inbox" size={28} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No reports yet</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    padding: 16,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  greeting: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  appTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  sosBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  sosBtnText: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  reportBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  reportBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  reportBannerText: { flex: 1 },
  reportBannerTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  reportBannerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    marginBottom: -4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  seeAll: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  activityCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  activityContent: { flex: 1 },
  activityMsg: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  activityTime: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 3,
  },
  activityDivider: {
    height: 1,
    marginLeft: 30,
  },
  loader: { marginVertical: 20 },
  emptyState: {
    alignItems: "center",
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
