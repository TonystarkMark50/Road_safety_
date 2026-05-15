import { Feather } from "@expo/vector-icons";
import { useGetMe, useGetMyReports } from "@workspace/api-client-react";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ReportCard } from "@/components/ReportCard";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

function RoleTag({ role }: { role: string }) {
  const colors = useColors();
  const COLOR_MAP: Record<string, string> = {
    admin: "#a855f7",
    authority: "#f97316",
    emergency: "#ef4444",
    citizen: "#22c55e",
  };
  const color = COLOR_MAP[role] ?? colors.primary;
  return (
    <View style={[{ backgroundColor: color + "20", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }]}>
      <Text style={[{ color, fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" }]}>
        {role}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const { data: me } = useGetMe({ query: { enabled: !!user } });
  const { data: myReports } = useGetMyReports({ query: { enabled: !!user } });

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const profile = me ?? user;

  async function handleLogout() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  }

  if (!user) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: colors.background }]}>
        <View style={[styles.guestCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.guestIcon, { backgroundColor: colors.primary + "20" }]}>
            <Feather name="user" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.guestTitle, { color: colors.foreground }]}>Join RoadSoS AI</Text>
          <Text style={[styles.guestSub, { color: colors.mutedForeground }]}>
            Sign in to track your reports, get updates, and help improve civic infrastructure.
          </Text>
          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/login")}
            activeOpacity={0.8}
          >
            <Text style={[styles.loginBtnText, { color: colors.primaryForeground }]}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/register")}>
            <Text style={[styles.registerLink, { color: colors.primary }]}>Create an account</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.container,
        { paddingTop: topPad + 12, paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 100 },
      ]}
    >
      <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {profile?.name?.charAt(0)?.toUpperCase() ?? "U"}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: colors.foreground }]}>{profile?.name}</Text>
          <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>{profile?.email}</Text>
          {profile?.phone ? (
            <Text style={[styles.profilePhone, { color: colors.mutedForeground }]}>{profile.phone}</Text>
          ) : null}
          <RoleTag role={profile?.role ?? "citizen"} />
        </View>
      </View>

      <View style={styles.statsRow}>
        {[
          { label: "Reports Filed", value: myReports?.length ?? 0, icon: "file-text" as const, color: colors.primary },
          {
            label: "Resolved",
            value: myReports?.filter((r) => r.status === "resolved").length ?? 0,
            icon: "check-circle" as const,
            color: "#22c55e",
          },
        ].map((stat) => (
          <View key={stat.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.statIcon, { backgroundColor: stat.color + "20" }]}>
              <Feather name={stat.icon} size={18} color={stat.color} />
            </View>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{stat.value}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {[
          { label: "My Reports", icon: "file-text" as const, action: () => router.push("/(tabs)/reports") },
          { label: "New Report", icon: "plus-circle" as const, action: () => router.push("/report/new") },
          { label: "Emergency SOS", icon: "alert-triangle" as const, action: () => router.push("/(tabs)/emergency") },
        ].map((item, idx, arr) => (
          <View key={item.label}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={item.action}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIcon, { backgroundColor: colors.muted }]}>
                <Feather name={item.icon} size={16} color={colors.primary} />
              </View>
              <Text style={[styles.menuLabel, { color: colors.foreground }]}>{item.label}</Text>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
            {idx < arr.length - 1 && (
              <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            )}
          </View>
        ))}
      </View>

      {myReports && myReports.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>My Recent Reports</Text>
          {myReports.slice(0, 3).map((r) => (
            <ReportCard key={r.id} report={r} />
          ))}
        </>
      ) : null}

      <TouchableOpacity
        style={[styles.logoutBtn, { borderColor: colors.destructive + "50" }]}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <Feather name="log-out" size={16} color={colors.destructive} />
        <Text style={[styles.logoutText, { color: colors.destructive }]}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  container: {
    padding: 16,
    gap: 14,
  },
  guestCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
    gap: 14,
    width: "100%",
  },
  guestIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  guestTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  guestSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  loginBtn: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
  },
  loginBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  registerLink: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  profileCard: {
    flexDirection: "row",
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  profileEmail: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  profilePhone: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
    alignItems: "flex-start",
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  menuCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  menuDivider: {
    height: 1,
    marginLeft: 58,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  logoutText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
