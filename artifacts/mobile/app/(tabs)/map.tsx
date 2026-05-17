import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, {
  forwardRef, useCallback, useEffect, useImperativeHandle,
  useRef, useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

/* ─── Types ───────────────────────────────────────────────────────── */

type Report = {
  id: number; ticketId: string; title: string; category: string;
  description: string; status: string; latitude: number | null;
  longitude: number | null; address: string; severity: string;
  upvotes: number; createdAt: string; userName?: string;
};

type GeoResult = { label: string; lat: number; lng: number };

type MapViewHandle = { flyTo: (lat: number, lng: number) => void };

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
  { value: "pothole",         label: "Pothole" },
  { value: "road_damage",     label: "Road Damage" },
  { value: "accident",        label: "Accident" },
  { value: "waterlogging",    label: "Waterlogging" },
  { value: "signal_failure",  label: "Signal Failure" },
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
  critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#22c55e",
};

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN ?? ""}`;

/* ─── Leaflet HTML ────────────────────────────────────────────────── */

function buildMapHtml(reports: Report[]): string {
  const safe = JSON.stringify(reports).replace(/<\/script>/gi, "<\\/script>");
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:100%;height:100%;background:#0f172a}
  #map{width:100%;height:100%}
  .lp .leaflet-popup-content-wrapper{
    background:#1e293b;border:1px solid rgba(255,255,255,.1);
    border-radius:12px;color:#e2e8f0;box-shadow:0 20px 40px rgba(0,0,0,.6);padding:0
  }
  .lp .leaflet-popup-content{margin:12px 14px}
  .lp .leaflet-popup-tip{background:#1e293b}
  .lp .leaflet-popup-close-button{color:#64748b!important;font-size:18px!important;top:6px!important;right:8px!important}
  .leaflet-control-zoom a{background:#1e293b!important;color:#e2e8f0!important;border-color:#334155!important}
  .leaflet-control-attribution{background:rgba(15,23,42,.8)!important;color:#64748b!important;font-size:9px}
  .leaflet-control-attribution a{color:#94a3b8!important}
  #fly-pin{
    position:absolute;bottom:60px;left:50%;transform:translateX(-50%) translateY(0);
    background:rgba(59,130,246,0.9);color:#fff;padding:6px 14px;border-radius:20px;
    font-family:system-ui,sans-serif;font-size:12px;font-weight:600;
    box-shadow:0 4px 16px rgba(59,130,246,0.5);
    display:none;z-index:9999;pointer-events:none;
    animation:flyIn 0.3s ease;
  }
  @keyframes flyIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
</style>
</head>
<body>
<div id="map"></div>
<div id="fly-pin"></div>
<script>
var CAT_COLORS=${JSON.stringify(CATEGORY_COLORS)};
var reports=${safe};
function catLabel(c){return c.replace(/_/g,' ')}
function timeAgo(iso){
  var d=(Date.now()-new Date(iso).getTime())/1000;
  if(d<60)return 'just now';
  if(d<3600)return Math.floor(d/60)+'m ago';
  if(d<86400)return Math.floor(d/3600)+'h ago';
  return Math.floor(d/86400)+'d ago';
}
function sevColor(s){return{critical:'#ef4444',high:'#f97316',medium:'#eab308',low:'#22c55e'}[s]||'#6b7280'}
function sevRadius(s){return{critical:14,high:11,medium:9,low:7}[s]||9}
function makeIcon(cat,sev){
  var c=CAT_COLORS[cat]||'#9ca3af';var r=sevRadius(sev);var d=r*2+4;
  return L.divIcon({
    className:'',
    html:'<svg xmlns="http://www.w3.org/2000/svg" width="'+d+'" height="'+d+'"><circle cx="'+(r+2)+'" cy="'+(r+2)+'" r="'+r+'" fill="'+c+'" fill-opacity=".92" stroke="#fff" stroke-width="2"/><\/svg>',
    iconAnchor:[r+2,r+2],popupAnchor:[0,-(r+4)]
  });
}
var map=L.map('map',{center:[28.6139,77.209],zoom:12,zoomControl:true});
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{
  attribution:'© OSM © CARTO',subdomains:'abcd',maxZoom:19
}).addTo(map);
var layers=L.layerGroup().addTo(map);
function renderReports(list){
  layers.clearLayers();
  list.forEach(function(r){
    if(!r.latitude||!r.longitude)return;
    var c=CAT_COLORS[r.category]||'#9ca3af';var sc=sevColor(r.severity);
    var m=L.marker([r.latitude,r.longitude],{icon:makeIcon(r.category,r.severity)});
    m.bindPopup(
      '<div style="min-width:185px;font-family:system-ui,sans-serif">'+
      '<p style="font-weight:700;font-size:13px;margin:0 0 3px;line-height:1.3">'+r.title+'</p>'+
      '<p style="font-size:10px;color:#94a3b8;margin:0 0 7px">'+r.address+'</p>'+
      '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">'+
      '<span style="background:'+c+'22;color:'+c+';border-radius:4px;padding:2px 7px;font-size:10px;font-weight:600;text-transform:capitalize">'+catLabel(r.category)+'</span>'+
      '<span style="background:'+sc+'22;color:'+sc+';border-radius:4px;padding:2px 7px;font-size:10px;font-weight:600;text-transform:capitalize">'+r.severity+'</span>'+
      '</div>'+
      '<p style="font-size:10px;color:#94a3b8;margin:0 0 5px">'+r.description.slice(0,90)+(r.description.length>90?'…':'')+'</p>'+
      '<div style="display:flex;justify-content:space-between">'+
      '<span style="font-size:9px;color:#64748b">'+timeAgo(r.createdAt)+'</span>'+
      '<span style="font-size:9px;color:#64748b">▲ '+r.upvotes+'</span>'+
      '</div></div>',
      {maxWidth:240,className:'lp'}
    );
    m.addTo(layers);
  });
}
renderReports(reports);
window.updateReports=function(json){try{renderReports(JSON.parse(json));}catch(e){}};
window.flyTo=function(lat,lng,label){
  map.setView([lat,lng],15,{animate:true,duration:1.2,easeLinearity:0.1});
  var pin=document.getElementById('fly-pin');
  if(pin){
    pin.style.display='block';
    pin.textContent=label||'Location found';
    clearTimeout(window._pinTimer);
    window._pinTimer=setTimeout(function(){pin.style.display='none';},2500);
  }
  L.circleMarker([lat,lng],{radius:16,color:'#3b82f6',weight:2,fillColor:'#3b82f6',fillOpacity:0.25}).addTo(map);
};
<\/script>
</body>
</html>`;
}

/* ─── Platform-specific Map Views ────────────────────────────────── */

const NativeMapView = forwardRef<MapViewHandle, { html: string }>(function NativeMapView({ html }, ref) {
  const WebView = require("react-native-webview").WebView;
  const wvRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    flyTo(lat, lng) {
      wvRef.current?.injectJavaScript?.(`window.flyTo(${lat},${lng});true;`);
    },
  }));

  return (
    <WebView
      ref={wvRef}
      source={{ html }}
      style={{ flex: 1 }}
      originWhitelist={["*"]}
      javaScriptEnabled
      domStorageEnabled
      allowsInlineMediaPlayback
      mixedContentMode="always"
      onError={() => {}}
    />
  );
});

const WebMapView = forwardRef<MapViewHandle, { html: string }>(function WebMapView({ html }, ref) {
  const containerRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useImperativeHandle(ref, () => ({
    flyTo(lat, lng) {
      const cw = iframeRef.current?.contentWindow as any;
      cw?.flyTo?.(lat, lng);
    },
  }));

  useEffect(() => {
    if (!html || !containerRef.current) return;
    const container = containerRef.current as HTMLDivElement;
    if (!iframeRef.current) {
      const iframe = document.createElement("iframe");
      Object.assign(iframe.style, {
        width: "100%", height: "100%", border: "none",
        position: "absolute", top: "0", left: "0",
      });
      container.appendChild(iframe);
      iframeRef.current = iframe;
    }
    const iframe = iframeRef.current;
    if (iframe.contentDocument) {
      iframe.contentDocument.open();
      iframe.contentDocument.write(html);
      iframe.contentDocument.close();
    } else {
      iframe.srcdoc = html;
    }
  }, [html]);

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, width: "100%", height: "100%", position: "relative" } as React.CSSProperties}
    />
  );
});

const MapView = forwardRef<MapViewHandle, { html: string }>(function MapView({ html }, ref) {
  if (Platform.OS === "web") return <WebMapView ref={ref} html={html} />;
  return <NativeMapView ref={ref} html={html} />;
});

/* ─── Search Bar ──────────────────────────────────────────────────── */

function MapSearchBar({
  mapRef, topOffset,
}: {
  mapRef: React.RefObject<MapViewHandle | null>;
  topOffset: number;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  async function doSearch(q: string) {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`${BASE_URL}/api/map/geocode?q=${encodeURIComponent(q)}`, { credentials: "include" });
      const data = await res.json();
      setResults(
        (data.features ?? []).slice(0, 5).map((f: {
          properties: { label: string };
          geometry: { coordinates: [number, number] };
        }) => ({
          label: f.properties.label,
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0],
        }))
      );
    } catch { setResults([]); }
    finally { setSearching(false); }
  }

  function onChangeText(text: string) {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(() => doSearch(text), 420);
  }

  function onSelect(r: GeoResult) {
    setQuery(r.label);
    setResults([]);
    setFocused(false);
    Keyboard.dismiss();
    mapRef.current?.flyTo(r.lat, r.lng);
  }

  function onClear() {
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  }

  const showDropdown = focused && (results.length > 0 || searching);

  return (
    <View style={[ss.searchWrap, { top: topOffset }]}>
      {/* Input pill */}
      <View style={[ss.searchPill, focused && ss.searchPillFocused]}>
        <Feather name="search" size={16} color={focused ? "#3b82f6" : "#64748b"} />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search location…"
          placeholderTextColor="#475569"
          returnKeyType="search"
          onSubmitEditing={() => doSearch(query)}
          style={ss.searchInput}
        />
        {searching
          ? <ActivityIndicator size="small" color="#3b82f6" style={{ width: 18 }} />
          : query.length > 0
            ? <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x-circle" size={15} color="#64748b" />
              </TouchableOpacity>
            : <Feather name="map-pin" size={14} color="#334155" />
        }
      </View>

      {/* Dropdown */}
      {showDropdown && (
        <View style={ss.dropdown}>
          {searching && results.length === 0 && (
            <View style={ss.dropdownRow}>
              <ActivityIndicator size="small" color="#3b82f6" />
              <Text style={ss.dropdownSearching}>Searching…</Text>
            </View>
          )}
          {results.map((r, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => onSelect(r)}
              style={[ss.dropdownRow, i > 0 && ss.dropdownDivider]}
              activeOpacity={0.7}
            >
              <View style={ss.dropdownPin}>
                <Feather name="map-pin" size={12} color="#3b82f6" />
              </View>
              <Text style={ss.dropdownLabel} numberOfLines={2}>{r.label}</Text>
              <Feather name="arrow-up-left" size={12} color="#334155" />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  searchWrap: {
    position: "absolute", left: 12, right: 12, zIndex: 30,
  },
  searchPill: {
    flexDirection: "row", alignItems: "center", gap: 9,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 28, paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  searchPillFocused: {
    borderColor: "rgba(59,130,246,0.5)",
    shadowColor: "#3b82f6", shadowOpacity: 0.25,
  },
  searchInput: {
    flex: 1, fontSize: 14, color: "#e2e8f0",
    paddingVertical: 0,
  },
  dropdown: {
    marginTop: 6, backgroundColor: "rgba(15,23,42,0.97)",
    borderRadius: 18, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 12,
  },
  dropdownRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  dropdownDivider: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)" },
  dropdownPin: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "rgba(59,130,246,0.12)",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  dropdownLabel: {
    flex: 1, fontSize: 13, color: "#cbd5e1", lineHeight: 18,
  },
  dropdownSearching: { fontSize: 13, color: "#64748b", marginLeft: 8 },
});

/* ─── Report Form Modal ───────────────────────────────────────────── */

function ReportModal({
  visible, onClose, onSuccess, colors,
}: {
  visible: boolean; onClose: () => void; onSuccess: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [form, setForm] = useState({
    title: "", category: "pothole", description: "",
    severity: "medium", latitude: "", longitude: "", address: "",
  });
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const insets = useSafeAreaInsets();

  function update(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }

  async function captureGPS() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission denied", "Location access is needed."); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = loc.coords.latitude; const lng = loc.coords.longitude;
      update("latitude", lat.toFixed(6)); update("longitude", lng.toFixed(6));
      const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (geo.length > 0) {
        const g = geo[0];
        update("address", [g.name, g.street, g.district, g.city].filter(Boolean).join(", ") || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      }
    } catch { Alert.alert("Error", "Could not get location."); }
    finally { setLocating(false); }
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.address.trim()) { Alert.alert("Missing fields", "Fill in title and location."); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/reports`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title, category: form.category,
          description: form.description || "No description provided.",
          severity: form.severity,
          latitude: form.latitude ? parseFloat(form.latitude) : null,
          longitude: form.longitude ? parseFloat(form.longitude) : null,
          address: form.address,
        }),
      });
      if (res.ok) {
        setForm({ title: "", category: "pothole", description: "", severity: "medium", latitude: "", longitude: "", address: "" });
        onSuccess();
      } else Alert.alert("Error", "Could not submit. Try again.");
    } catch { Alert.alert("Error", "Network error."); }
    finally { setSubmitting(false); }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Report an Issue</Text>
          <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Issue Title *</Text>
          <TextInput
            value={form.title} onChangeText={(v) => update("title", v)}
            placeholder="e.g. Large pothole on MG Road" placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
          />
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 7 }}>
              {CATEGORIES.map((c) => {
                const active = form.category === c.value;
                const col = CATEGORY_COLORS[c.value] ?? "#9ca3af";
                return (
                  <TouchableOpacity key={c.value} onPress={() => update("category", c.value)}
                    style={[styles.chip, { backgroundColor: active ? col : colors.muted, borderColor: active ? col : colors.border }]}>
                    <Text style={[styles.chipText, { color: active ? "#fff" : colors.mutedForeground }]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Severity</Text>
          <View style={{ flexDirection: "row", gap: 7 }}>
            {SEVERITIES.map((s) => {
              const active = form.severity === s.value;
              const col = SEVERITY_COLORS[s.value];
              return (
                <TouchableOpacity key={s.value} onPress={() => update("severity", s.value)}
                  style={[styles.sevBtn, { flex: 1, backgroundColor: active ? col : colors.muted, borderColor: active ? col : colors.border }]}>
                  <Text style={[styles.chipText, { color: active ? "#fff" : colors.mutedForeground }]}>{s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Location *</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              value={form.address} onChangeText={(v) => update("address", v)}
              placeholder="Address or landmark" placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { flex: 1, backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            />
            <TouchableOpacity onPress={captureGPS} disabled={locating}
              style={[styles.gpsBtn, { backgroundColor: colors.primary }]}>
              {locating ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="crosshair" size={16} color="#fff" />}
            </TouchableOpacity>
          </View>
          {form.latitude ? (
            <Text style={[styles.gpsCoords, { color: colors.mutedForeground }]}>
              📍 {parseFloat(form.latitude).toFixed(5)}, {parseFloat(form.longitude).toFixed(5)}
            </Text>
          ) : null}
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Description</Text>
          <TextInput
            value={form.description} onChangeText={(v) => update("description", v)}
            placeholder="Describe the issue…" placeholderTextColor={colors.mutedForeground}
            multiline numberOfLines={3}
            style={[styles.input, styles.textArea, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
          />
          <TouchableOpacity onPress={handleSubmit} disabled={submitting}
            style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }]}>
            {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="send" size={16} color="#fff" />}
            <Text style={styles.submitBtnText}>{submitting ? "Submitting…" : "Submit Report"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ─── Main Screen ─────────────────────────────────────────────────── */

export default function MapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const mapRef = useRef<MapViewHandle>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [mapHtml, setMapHtml] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  const loadReports = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/reports?limit=150`, { credentials: "include" });
      if (!res.ok) { if (!mapHtml) setMapHtml(buildMapHtml([])); return; }
      const data = await res.json();
      const list: Report[] = data.reports ?? [];
      setReports(list);
      setMapHtml(buildMapHtml(list));
    } catch { if (!mapHtml) setMapHtml(buildMapHtml([])); }
  }, [mapHtml]);

  useEffect(() => {
    loadReports();
    const id = setInterval(loadReports, 30_000);
    return () => clearInterval(id);
  }, []);

  function handleSuccess() {
    setShowForm(false); setShowSuccess(true);
    setTimeout(() => { setShowSuccess(false); loadReports(); }, 3000);
  }

  const highCount = reports.filter((r) => r.severity === "critical" || r.severity === "high").length;
  const headerTop = topPad + 8;
  const searchTop = headerTop + 58; // below header pill

  return (
    <View style={[styles.container, { backgroundColor: "#0f172a" }]}>
      {/* Full-screen map */}
      {mapHtml ? (
        <MapView ref={mapRef} html={mapHtml} />
      ) : (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading map…</Text>
        </View>
      )}

      {/* Header pill */}
      <View style={[styles.header, { top: headerTop }]}>
        <View style={styles.headerInner}>
          <View style={styles.titleRow}>
            <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
            <Text style={styles.headerTitle}>Live Road Map</Text>
            <Text style={styles.headerSub}>{reports.length} reports</Text>
          </View>
          {highCount > 0 && (
            <View style={styles.alertBadge}>
              <Feather name="alert-triangle" size={11} color="#ef4444" />
              <Text style={styles.alertBadgeText}>{highCount} critical</Text>
            </View>
          )}
        </View>
      </View>

      {/* Search bar — below header */}
      <MapSearchBar mapRef={mapRef} topOffset={searchTop} />

      {/* Success toast */}
      {showSuccess && (
        <View style={styles.successToast}>
          <Feather name="check-circle" size={14} color="#22c55e" />
          <Text style={styles.successText}>Report submitted! Appears on map shortly.</Text>
        </View>
      )}

      {/* Category legend */}
      <View style={[styles.legend, { bottom: Platform.OS === "web" ? 56 : insets.bottom + 49 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.legendRow}>
            {Object.entries(CATEGORY_COLORS).map(([cat, col]) => (
              <View key={cat} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: col }]} />
                <Text style={styles.legendLabel}>{cat.replace("_", " ")}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: (Platform.OS === "web" ? 56 : insets.bottom + 49) + 58 }]}
        onPress={() => setShowForm(true)}
        activeOpacity={0.88}
      >
        <Feather name="plus" size={20} color="#fff" />
        <Text style={styles.fabText}>Report Issue</Text>
      </TouchableOpacity>

      <ReportModal visible={showForm} onClose={() => setShowForm(false)} onSuccess={handleSuccess} colors={colors} />
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { position: "absolute", left: 12, right: 12, zIndex: 20 },
  headerInner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "rgba(15,23,42,0.92)", borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22c55e" },
  headerTitle: { color: "#f1f5f9", fontWeight: "700", fontSize: 15 },
  headerSub: { color: "#64748b", fontSize: 12 },
  alertBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#ef444418", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: "#ef444433",
  },
  alertBadgeText: { color: "#ef4444", fontSize: 11, fontWeight: "600" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#0f172a" },
  loadingText: { color: "#94a3b8", fontSize: 14 },
  successToast: {
    position: "absolute", top: 180, left: 16, right: 16,
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#0f172a", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "#22c55e44", zIndex: 20,
  },
  successText: { color: "#22c55e", fontSize: 12, fontWeight: "500", flex: 1 },
  legend: {
    position: "absolute", left: 0, right: 0,
    backgroundColor: "rgba(15,23,42,0.92)",
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)",
    paddingVertical: 8, zIndex: 10,
  },
  legendRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendLabel: { color: "#64748b", fontSize: 9, textTransform: "capitalize" },
  fab: {
    position: "absolute", right: 16, zIndex: 20,
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#3b82f6", borderRadius: 28,
    paddingHorizontal: 18, paddingVertical: 13,
    shadowColor: "#3b82f6", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55, shadowRadius: 14, elevation: 8,
  },
  fabText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  modalBody: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 12, fontWeight: "500", marginTop: 16, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textArea: { height: 80, textAlignVertical: "top", paddingTop: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: "500" },
  sevBtn: { paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  gpsBtn: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  gpsCoords: { fontSize: 10, marginTop: 4 },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14, borderRadius: 14, marginTop: 24, marginBottom: 8,
  },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
