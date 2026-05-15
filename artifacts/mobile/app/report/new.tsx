import { Feather } from "@expo/vector-icons";
import { useCreateReport } from "@workspace/api-client-react";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

type Category = "pothole" | "road_damage" | "accident" | "waterlogging" | "signal_failure" | "illegal_parking" | "congestion" | "other";
type Severity = "low" | "medium" | "high" | "critical";

const CATEGORIES: { value: Category; label: string; icon: React.ComponentProps<typeof Feather>["name"] }[] = [
  { value: "pothole", label: "Pothole", icon: "alert-circle" },
  { value: "road_damage", label: "Road Damage", icon: "tool" },
  { value: "accident", label: "Accident", icon: "alert-triangle" },
  { value: "waterlogging", label: "Waterlogging", icon: "droplet" },
  { value: "signal_failure", label: "Signal Failure", icon: "alert-octagon" },
  { value: "illegal_parking", label: "Illegal Parking", icon: "slash" },
  { value: "congestion", label: "Congestion", icon: "activity" },
  { value: "other", label: "Other", icon: "help-circle" },
];

const SEVERITIES: { value: Severity; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "#22c55e" },
  { value: "medium", label: "Medium", color: "#f59e0b" },
  { value: "high", label: "High", color: "#f97316" },
  { value: "critical", label: "Critical", color: "#ef4444" },
];

export default function NewReportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const createMutation = useCreateReport();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [category, setCategory] = useState<Category>("pothole");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);

  useEffect(() => {
    fetchLocation();
  }, []);

  async function fetchLocation() {
    setLocLoading(true);
    try {
      if (Platform.OS === "web") {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((pos) => {
            setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setLocLoading(false);
          }, () => setLocLoading(false));
        } else {
          setLocLoading(false);
        }
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocLoading(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      const geo = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      if (geo[0]) {
        const g = geo[0];
        const parts = [g.street, g.city, g.region].filter(Boolean);
        setAddress(parts.join(", "));
      }
    } catch {
      // ignore
    } finally {
      setLocLoading(false);
    }
  }

  async function handleSubmit() {
    if (!user) {
      Alert.alert("Sign In Required", "Please sign in to file a report.", [
        { text: "Cancel" },
        { text: "Sign In", onPress: () => router.push("/login") },
      ]);
      return;
    }
    if (!title.trim() || title.length < 5) {
      Alert.alert("Validation", "Title must be at least 5 characters.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Validation", "Please add a description.");
      return;
    }
    if (!address.trim()) {
      Alert.alert("Validation", "Please enter an address or location.");
      return;
    }

    try {
      await createMutation.mutateAsync({
        data: {
          title: title.trim(),
          description: description.trim(),
          address: address.trim(),
          category,
          severity,
          latitude: location?.lat ?? 28.6139,
          longitude: location?.lng ?? 77.209,
        },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Report Filed!", "Your complaint has been submitted. You'll receive updates on its status.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Failed to submit report. Please try again.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.navHeader, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>New Report</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.foreground }]}>Title *</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
            placeholder="Brief description of the issue"
            placeholderTextColor={colors.mutedForeground}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.foreground }]}>Category *</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => {
              const active = category === cat.value;
              return (
                <TouchableOpacity
                  key={cat.value}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: active ? colors.primary + "20" : colors.muted,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setCategory(cat.value)}
                  activeOpacity={0.75}
                >
                  <Feather name={cat.icon} size={14} color={active ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.categoryText, { color: active ? colors.primary : colors.mutedForeground }]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.foreground }]}>Severity *</Text>
          <View style={styles.severityRow}>
            {SEVERITIES.map((sev) => {
              const active = severity === sev.value;
              return (
                <TouchableOpacity
                  key={sev.value}
                  style={[
                    styles.severityChip,
                    { backgroundColor: active ? sev.color : sev.color + "18", borderColor: sev.color },
                  ]}
                  onPress={() => setSeverity(sev.value)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.severityText, { color: active ? "#fff" : sev.color }]}>
                    {sev.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.foreground }]}>Description *</Text>
          <TextInput
            style={[
              styles.textarea,
              { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border },
            ]}
            placeholder="Describe the issue in detail..."
            placeholderTextColor={colors.mutedForeground}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: colors.foreground }]}>Location *</Text>
            <TouchableOpacity onPress={fetchLocation} disabled={locLoading}>
              {locLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name="refresh-cw" size={15} color={colors.primary} />
              )}
            </TouchableOpacity>
          </View>
          {location && (
            <View style={[styles.locInfo, { backgroundColor: colors.muted }]}>
              <Feather name="map-pin" size={13} color={colors.primary} />
              <Text style={[styles.locText, { color: colors.mutedForeground }]}>
                {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </Text>
            </View>
          )}
          <TextInput
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
            placeholder="Street address or landmark"
            placeholderTextColor={colors.mutedForeground}
            value={address}
            onChangeText={setAddress}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.primary }, createMutation.isPending && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={createMutation.isPending}
          activeOpacity={0.85}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Feather name="send" size={16} color={colors.primaryForeground} />
              <Text style={[styles.submitText, { color: colors.primaryForeground }]}>Submit Report</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  },
  container: {
    padding: 16,
    gap: 12,
  },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  textarea: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    height: 100,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  severityRow: {
    flexDirection: "row",
    gap: 8,
  },
  severityChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  severityText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  locInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
    borderRadius: 6,
  },
  locText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  submitText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
