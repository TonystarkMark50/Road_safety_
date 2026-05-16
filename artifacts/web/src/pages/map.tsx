import { useGetHeatmapData, getGetHeatmapDataQueryKey, useListReports, getListReportsQueryKey } from "@workspace/api-client-react";
import { StatusBadge, SeverityBadge } from "@/components/StatusBadge";
import { MapPin, Layers, AlertCircle, Search, X, Navigation } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Circle,
  Marker,
  InfoWindow,
} from "@react-google-maps/api";

const categoryColors: Record<string, string> = {
  pothole: "#3b82f6",
  road_damage: "#f97316",
  accident: "#ef4444",
  waterlogging: "#22c55e",
  signal_failure: "#eab308",
  illegal_parking: "#a855f7",
  congestion: "#06b6d4",
  other: "#6b7280",
};

const severityRadius: Record<string, number> = {
  critical: 120,
  high: 90,
  medium: 65,
  low: 45,
};

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const MAP_CONTAINER_STYLE = { width: "100%", height: "480px" };
const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 };
const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: false,
  mapTypeControl: true,
  streetViewControl: false,
  fullscreenControl: true,
  mapTypeId: "roadmap",
  styles: [
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "simplified" }] },
  ],
};

interface GeoFeature {
  geometry: { coordinates: [number, number] };
  properties: { label: string };
}

export default function MapView() {
  const { data: heatmap } = useGetHeatmapData({ query: { queryKey: getGetHeatmapDataQueryKey() } });
  const { data: reportsData } = useListReports({ params: { limit: 50 }, options: { queryKey: getListReportsQueryKey({ limit: 50 }) } });

  const reports = reportsData?.reports ?? [];
  const points = heatmap ?? [];

  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/map/config`)
      .then((r) => r.json())
      .then((d) => setApiKey(d.googleMapsApiKey ?? ""))
      .catch(() => setApiKey(""));
  }, []);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey ?? "",
    id: "google-map-script",
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const onLoad = useCallback((map: google.maps.Map) => { mapRef.current = map; }, []);
  const onUnmount = useCallback(() => { mapRef.current = null; }, []);

  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<GeoFeature[]>([]);
  const [selectedReport, setSelectedReport] = useState<typeof reports[0] | null>(null);
  const [infoPos, setInfoPos] = useState<{ lat: number; lng: number } | null>(null);

  async function handleGeocode(q: string) {
    if (!q.trim()) { setSuggestions([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`${BASE}/api/map/geocode?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSuggestions(data.features ?? []);
    } catch { setSuggestions([]); }
    finally { setSearching(false); }
  }

  function selectPlace(feat: GeoFeature) {
    const [lng, lat] = feat.geometry.coordinates;
    mapRef.current?.panTo({ lat, lng });
    mapRef.current?.setZoom(15);
    setSuggestions([]);
    setSearch(feat.properties.label);
  }

  function flyToReport(r: typeof reports[0]) {
    if (!r.latitude || !r.longitude) return;
    mapRef.current?.panTo({ lat: r.latitude, lng: r.longitude });
    mapRef.current?.setZoom(16);
    setSelectedReport(r);
    setInfoPos({ lat: r.latitude, lng: r.longitude });
  }

  if (apiKey === null) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Loading map configuration…</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-serif)]">Road Issue Map</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Live geographic visualization of reported road issues</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-border gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <Layers className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Live Map</span>
              <span className="text-xs text-muted-foreground">({reports.length} reports)</span>
            </div>
            <div className="relative flex-1 max-w-xs">
              <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-1.5 bg-muted/40">
                <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); handleGeocode(e.target.value); }}
                  placeholder="Search location…"
                  className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1 min-w-0"
                />
                {search && (
                  <button onClick={() => { setSearch(""); setSuggestions([]); }}>
                    <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-[1000] overflow-hidden max-h-48 overflow-y-auto">
                  {suggestions.map((f, i) => (
                    <button
                      key={i}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors flex items-center gap-2"
                      onClick={() => selectPlace(f)}
                    >
                      <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{f.properties.label}</span>
                    </button>
                  ))}
                </div>
              )}
              {searching && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg p-3 text-xs text-muted-foreground text-center z-[1000]">
                  Searching…
                </div>
              )}
            </div>
          </div>

          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              center={DEFAULT_CENTER}
              zoom={12}
              options={MAP_OPTIONS}
              onLoad={onLoad}
              onUnmount={onUnmount}
            >
              {points.map((p, i) => (
                <Circle
                  key={`heat-${i}`}
                  center={{ lat: p.latitude, lng: p.longitude }}
                  radius={Math.max(200, p.intensity * 800)}
                  options={{
                    fillColor: categoryColors[p.category] ?? "#6b7280",
                    fillOpacity: 0.15,
                    strokeColor: categoryColors[p.category] ?? "#6b7280",
                    strokeOpacity: 0.3,
                    strokeWeight: 1,
                  }}
                />
              ))}

              {reports.map((r) => {
                if (!r.latitude || !r.longitude) return null;
                const color = categoryColors[r.category] ?? "#6b7280";
                return (
                  <Marker
                    key={r.id}
                    position={{ lat: r.latitude, lng: r.longitude }}
                    icon={{
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: severityRadius[r.severity] ? severityRadius[r.severity] / 10 : 7,
                      fillColor: color,
                      fillOpacity: 0.9,
                      strokeColor: "#ffffff",
                      strokeWeight: 2,
                    }}
                    onClick={() => {
                      setSelectedReport(r);
                      setInfoPos({ lat: r.latitude!, lng: r.longitude! });
                    }}
                  />
                );
              })}

              {selectedReport && infoPos && (
                <InfoWindow
                  position={infoPos}
                  onCloseClick={() => { setSelectedReport(null); setInfoPos(null); }}
                >
                  <div style={{ minWidth: 180, fontFamily: "system-ui,sans-serif" }}>
                    <p style={{ fontWeight: 700, fontSize: 13, margin: "0 0 4px" }}>{selectedReport.title}</p>
                    <p style={{ fontSize: 11, color: "#888", margin: "0 0 6px" }}>{selectedReport.address}</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                      <span style={{
                        background: `${categoryColors[selectedReport.category] ?? "#6b7280"}22`,
                        color: categoryColors[selectedReport.category] ?? "#6b7280",
                        borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600, textTransform: "capitalize"
                      }}>
                        {selectedReport.category.replace("_", " ")}
                      </span>
                      <span style={{ background: "#f3f4f6", color: "#374151", borderRadius: 4, padding: "2px 8px", fontSize: 11, textTransform: "capitalize" }}>
                        {selectedReport.severity}
                      </span>
                    </div>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm" style={{ height: 480 }}>
              {apiKey ? "Loading Google Maps…" : "Google Maps API key not configured"}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> Legend
            </h3>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(categoryColors).map(([cat, color]) => (
                <div key={cat} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-xs text-muted-foreground capitalize">{cat.replace("_", " ")}</span>
                </div>
              ))}
            </div>
          </div>

          {selectedReport && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-foreground leading-tight">{selectedReport.title}</h3>
                <button onClick={() => { setSelectedReport(null); setInfoPos(null); }} className="text-muted-foreground hover:text-foreground shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <MapPin className="w-3 h-3" />{selectedReport.address}
              </p>
              <div className="flex gap-1 mb-3">
                <StatusBadge status={selectedReport.status} />
                <SeverityBadge severity={selectedReport.severity} />
              </div>
              <Link href={`/reports/${selectedReport.id}`}>
                <span className="text-xs text-primary font-medium hover:underline">View full report →</span>
              </Link>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                High Priority Issues
              </h3>
            </div>
            <div className="divide-y divide-border max-h-72 overflow-y-auto">
              {reports.filter((r) => r.severity === "critical" || r.severity === "high").slice(0, 8).map((r) => (
                <button
                  key={r.id}
                  className="w-full p-3 hover:bg-muted/40 cursor-pointer transition-colors text-left"
                  onClick={() => flyToReport(r)}
                >
                  <p className="text-xs font-medium truncate mb-1">{r.title}</p>
                  <div className="flex gap-1 mb-1">
                    <StatusBadge status={r.status} />
                    <SeverityBadge severity={r.severity} />
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Navigation className="w-2.5 h-2.5" />{r.address.split(",")[0]}
                  </p>
                </button>
              ))}
              {reports.filter((r) => r.severity === "critical" || r.severity === "high").length === 0 && (
                <p className="text-xs text-muted-foreground p-4 text-center">No high priority issues</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
