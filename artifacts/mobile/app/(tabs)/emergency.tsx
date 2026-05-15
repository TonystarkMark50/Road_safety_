import { Feather } from "@expo/vector-icons";
import { useListEmergencyServices, useTriggerSOS } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const TYPE_CONFIG: Record<string, { icon: React.ComponentProps<typeof Feather>["name"]; color: string; label: string }> = {
  hospital: { icon: "plus-square", color: "#22c55e", label: "Hospital" },
  police: { icon: "shield", color: "#4ba8f7", label: "Police" },
  fire: { icon: "alert-octagon", color: "#f97316", label: "Fire" },
  ambulance: { icon: "activity", color: "#ef4444", label: "Ambulance" },
};

export default function EmergencyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [sosActive, setSosActive] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState("");

  const sosMutation = useTriggerSOS();
  const { data: services, isLoading: servicesLoading } = useListEmergencyServices({
    lat: location?.lat,
    lng: location?.lng,
    type: "all",
  });

  useEffect(() => {
    async function getLocation() {
      if (Platform.OS === "web") {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => setLocationError("Location unavailable"),
          );
        }
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("Location permission denied");
        return;
      }
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        setLocationError("Could not get location");
      }
    }
    getLocation();
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => {
      if (countdown === 1) {
        triggerSOS();
        setCountdown(0);
        setSosActive(false);
      } else {
        setCountdown((c) => c - 1);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  async function handleSOSPress() {
    if (sosActive) {
      setSosActive(false);
      setCountdown(0);
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSosActive(true);
    setCountdown(3);
  }

  async function triggerSOS() {
    try {
      const lat = location?.lat ?? 28.6139;
      const lng = location?.lng ?? 77.209;
      await sosMutation.mutateAsync({ data: { latitude: lat, longitude: lng } });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("SOS Sent", "Emergency services have been alerted. Help is on the way.", [
        { text: "OK" },
      ]);
    } catch {
      Alert.alert("Error", "Failed to send SOS. Please call emergency services directly.");
    }
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.container,
        { paddingTop: topPad + 12, paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 100 },
      ]}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Emergency</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Press SOS to alert emergency services
      </Text>

      <View style={styles.sosContainer}>
        <TouchableOpacity
          style={[
            styles.sosButton,
            { backgroundColor: sosActive ? "#c0392b" : colors.destructive },
          ]}
          onPress={handleSOSPress}
          activeOpacity={0.85}
        >
          {sosActive ? (
            <>
              <Text style={styles.sosCountdown}>{countdown}</Text>
              <Text style={styles.sosCancelText}>Tap to cancel</Text>
            </>
          ) : (
            <>
              <Feather name="alert-triangle" size={40} color="#fff" />
              <Text style={styles.sosText}>SOS</Text>
              <Text style={styles.sosHelp}>Hold 3 seconds to send</Text>
            </>
          )}
        </TouchableOpacity>
        {sosActive && (
          <Text style={[styles.sosWarning, { color: colors.destructive }]}>
            Sending SOS in {countdown}...
          </Text>
        )}
      </View>

      <View style={styles.quickCalls}>
        {[
          { label: "Police", number: "100", icon: "shield" as const, color: "#4ba8f7" },
          { label: "Ambulance", number: "108", icon: "activity" as const, color: "#ef4444" },
          { label: "Fire", number: "101", icon: "alert-octagon" as const, color: "#f97316" },
          { label: "Women Help", number: "1091", icon: "phone" as const, color: "#a855f7" },
        ].map((item) => (
          <TouchableOpacity
            key={item.number}
            style={[styles.callBtn, { backgroundColor: item.color + "18", borderColor: item.color + "40" }]}
            onPress={() => Linking.openURL(`tel:${item.number}`)}
            activeOpacity={0.8}
          >
            <Feather name={item.icon} size={22} color={item.color} />
            <Text style={[styles.callLabel, { color: colors.foreground }]}>{item.label}</Text>
            <Text style={[styles.callNumber, { color: item.color }]}>{item.number}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {locationError ? (
        <View style={[styles.locError, { backgroundColor: colors.warning + "18" }]}>
          <Feather name="map-pin" size={14} color={colors.warning} />
          <Text style={[styles.locErrorText, { color: colors.warning }]}>{locationError}</Text>
        </View>
      ) : null}

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Nearby Services</Text>

      {servicesLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : services?.length ? (
        services.slice(0, 8).map((svc) => {
          const config = TYPE_CONFIG[svc.type] ?? { icon: "map-pin" as const, color: colors.primary, label: svc.type };
          return (
            <TouchableOpacity
              key={svc.id}
              style={[styles.serviceCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => Linking.openURL(`tel:${svc.phone}`)}
              activeOpacity={0.8}
            >
              <View style={[styles.serviceIcon, { backgroundColor: config.color + "20" }]}>
                <Feather name={config.icon} size={20} color={config.color} />
              </View>
              <View style={styles.serviceInfo}>
                <Text style={[styles.serviceName, { color: colors.foreground }]}>{svc.name}</Text>
                <Text style={[styles.serviceAddress, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {svc.address}
                </Text>
                <View style={styles.serviceMeta}>
                  <View style={[styles.typeTag, { backgroundColor: config.color + "18" }]}>
                    <Text style={[styles.typeTagText, { color: config.color }]}>{config.label}</Text>
                  </View>
                  {svc.distanceKm != null && (
                    <Text style={[styles.distance, { color: colors.mutedForeground }]}>
                      {svc.distanceKm.toFixed(1)} km
                    </Text>
                  )}
                  <View style={[styles.availDot, { backgroundColor: svc.isAvailable ? "#22c55e" : "#ef4444" }]} />
                  <Text style={[styles.availText, { color: svc.isAvailable ? "#22c55e" : "#ef4444" }]}>
                    {svc.isAvailable ? "Available" : "Busy"}
                  </Text>
                </View>
              </View>
              <Feather name="phone-call" size={18} color={config.color} />
            </TouchableOpacity>
          );
        })
      ) : (
        <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="map-pin" size={24} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No services found nearby
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    padding: 16,
    gap: 16,
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
  sosContainer: {
    alignItems: "center",
    gap: 12,
  },
  sosButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  sosText: {
    color: "#fff",
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
  },
  sosHelp: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  sosCountdown: {
    color: "#fff",
    fontSize: 64,
    fontFamily: "Inter_700Bold",
  },
  sosCancelText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  sosWarning: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  quickCalls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  callBtn: {
    flex: 1,
    minWidth: "45%",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  callLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  callNumber: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  locError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
  },
  locErrorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  loader: { marginVertical: 20 },
  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  serviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceInfo: { flex: 1 },
  serviceName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  serviceAddress: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  serviceMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  typeTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  typeTagText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  distance: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  availDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  availText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  empty: {
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
