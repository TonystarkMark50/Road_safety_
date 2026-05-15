import { Feather } from "@expo/vector-icons";
import { useGetBudgetOverview, useListBudgetProjects, useListRoads } from "@workspace/api-client-react";
import React, { useState } from "react";
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

type Tab = "budget" | "roads";

function formatCrore(val: number) {
  const crore = val / 10000000;
  if (crore >= 1) return `₹${crore.toFixed(1)}Cr`;
  const lakh = val / 100000;
  if (lakh >= 1) return `₹${lakh.toFixed(1)}L`;
  return `₹${val.toLocaleString()}`;
}

const QUALITY_COLOR = (score: number) => {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#f59e0b";
  if (score >= 40) return "#f97316";
  return "#ef4444";
};

const BUDGET_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  planned: { color: "#7a8499", label: "Planned" },
  in_progress: { color: "#4ba8f7", label: "In Progress" },
  completed: { color: "#22c55e", label: "Completed" },
  delayed: { color: "#ef4444", label: "Delayed" },
};

export default function TransparencyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>("budget");

  const { data: budgetOverview, isLoading: budgetLoading } = useGetBudgetOverview();
  const { data: projects, isLoading: projectsLoading } = useListBudgetProjects();
  const { data: roads, isLoading: roadsLoading } = useListRoads();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.container,
        { paddingTop: topPad + 12, paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 100 },
      ]}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Transparency</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Budget & road quality data
      </Text>

      <View style={[styles.tabBar, { backgroundColor: colors.muted }]}>
        {(["budget", "roads"] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && { backgroundColor: colors.card }]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.8}
          >
            <Feather
              name={tab === "budget" ? "dollar-sign" : "map"}
              size={14}
              color={activeTab === tab ? colors.primary : colors.mutedForeground}
            />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab ? colors.foreground : colors.mutedForeground },
              ]}
            >
              {tab === "budget" ? "Budget" : "Roads"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "budget" ? (
        <>
          {budgetLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : budgetOverview ? (
            <>
              <View style={[styles.overviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Budget Overview</Text>
                <View style={styles.overviewRow}>
                  <View style={styles.overviewItem}>
                    <Text style={[styles.overviewLabel, { color: colors.mutedForeground }]}>Sanctioned</Text>
                    <Text style={[styles.overviewValue, { color: colors.foreground }]}>
                      {formatCrore(budgetOverview.totalSanctioned)}
                    </Text>
                  </View>
                  <View style={[styles.overviewDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.overviewItem}>
                    <Text style={[styles.overviewLabel, { color: colors.mutedForeground }]}>Spent</Text>
                    <Text style={[styles.overviewValue, { color: colors.primary }]}>
                      {formatCrore(budgetOverview.totalSpent)}
                    </Text>
                  </View>
                  <View style={[styles.overviewDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.overviewItem}>
                    <Text style={[styles.overviewLabel, { color: colors.mutedForeground }]}>Remaining</Text>
                    <Text style={[styles.overviewValue, { color: "#22c55e" }]}>
                      {formatCrore(budgetOverview.totalRemaining)}
                    </Text>
                  </View>
                </View>

                <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(budgetOverview.utilizationRate ?? 0, 100)}%` as `${number}%`,
                        backgroundColor: colors.primary,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
                  {(budgetOverview.utilizationRate ?? 0).toFixed(1)}% utilized · {budgetOverview.completedProjects}/{budgetOverview.projectCount} projects complete
                </Text>
              </View>

              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Projects</Text>
              {projectsLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                projects?.map((project) => {
                  const status = BUDGET_STATUS_CONFIG[project.status] ?? {
                    color: colors.mutedForeground,
                    label: project.status,
                  };
                  const pct = project.sanctionedAmount > 0
                    ? (project.spentAmount / project.sanctionedAmount) * 100
                    : 0;
                  return (
                    <View
                      key={project.id}
                      style={[styles.projectCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <View style={styles.projectHeader}>
                        <Text style={[styles.projectName, { color: colors.foreground }]} numberOfLines={2}>
                          {project.name}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: status.color + "20" }]}>
                          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                        </View>
                      </View>
                      <Text style={[styles.projectDept, { color: colors.mutedForeground }]}>
                        {project.department} {project.contractorName ? `· ${project.contractorName}` : ""}
                      </Text>
                      <View style={styles.projectAmounts}>
                        <Text style={[styles.projectAmount, { color: colors.foreground }]}>
                          {formatCrore(project.spentAmount)}{" "}
                          <Text style={{ color: colors.mutedForeground }}>/ {formatCrore(project.sanctionedAmount)}</Text>
                        </Text>
                        <Text style={[styles.pctText, { color: colors.primary }]}>{pct.toFixed(0)}%</Text>
                      </View>
                      <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${Math.min(pct, 100)}%` as `${number}%`, backgroundColor: status.color },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })
              )}
            </>
          ) : null}
        </>
      ) : (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Road Segments</Text>
          {roadsLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : (
            roads?.map((road) => {
              const qColor = QUALITY_COLOR(road.qualityScore);
              return (
                <View
                  key={road.id}
                  style={[styles.roadCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.roadHeader}>
                    <View style={styles.roadTitleRow}>
                      <View style={[styles.roadTypeBadge, { backgroundColor: colors.primary + "20" }]}>
                        <Text style={[styles.roadTypeText, { color: colors.primary }]}>{road.type}</Text>
                      </View>
                      <Text style={[styles.roadName, { color: colors.foreground }]} numberOfLines={1}>
                        {road.name}
                      </Text>
                    </View>
                    <View style={[styles.qualityCircle, { borderColor: qColor }]}>
                      <Text style={[styles.qualityScore, { color: qColor }]}>{road.qualityScore}</Text>
                    </View>
                  </View>
                  <View style={styles.roadMeta}>
                    <Feather name="tool" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.roadMetaText, { color: colors.mutedForeground }]}>
                      {road.department} · {road.contractorName}
                    </Text>
                  </View>
                  <View style={styles.roadMeta}>
                    <Feather name="calendar" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.roadMetaText, { color: colors.mutedForeground }]}>
                      Last maintained: {road.lastMaintained}
                    </Text>
                  </View>
                  <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${road.qualityScore}%` as `${number}%`, backgroundColor: qColor },
                      ]}
                    />
                  </View>
                </View>
              );
            })
          )}
        </>
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
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: -8,
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  loader: { marginVertical: 20 },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  overviewCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  overviewRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  overviewItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  overviewLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  overviewValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  overviewDivider: {
    width: 1,
    height: 36,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  projectCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  projectHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  projectName: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 20,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  projectDept: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  projectAmounts: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  projectAmount: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  pctText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  roadCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  roadHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roadTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  roadTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roadTypeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  roadName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  qualityCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  qualityScore: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  roadMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  roadMetaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
