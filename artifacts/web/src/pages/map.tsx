import { useGetHeatmapData, getGetHeatmapDataQueryKey, useListReports, getListReportsQueryKey } from "@workspace/api-client-react";
import { StatusBadge, SeverityBadge } from "@/components/StatusBadge";
import { MapPin, Layers, AlertCircle, Search, X, Navigation } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

const severityWeight: Record<string, number> = {
  critical: 14,
  high: 11,
  medium: 8,
  low: 6,
};

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface GeoFeature {
  geometry: { coordinates: [number, number] };
  properties: { label: string };
}

export default function MapView() {
  const { data: heatmap } = useGetHeatmapData({ query: { queryKey: getGetHeatmapDataQueryKey() } });
  const { data: reportsData } = useListReports({ params: { limit: 50 }, options: { queryKey: getListReportsQueryKey({ limit: 50 }) } });

  const reports = reportsData?.reports ?? [];
  const points = heatmap ?? [];

  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<GeoFeature[]>([]);
  const [selectedReport, setSelectedReport] = useState<typeof reports[0] | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [28.6139, 77.2090],
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;
    markersRef.current.clearLayers();

    points.forEach((p) => {
      const color = categoryColors[p.category] ?? "#6b7280";
      const radius = Math.max(20, p.intensity * 60);
      L.circle([p.latitude, p.longitude], {
        radius,
        color,
        fillColor: color,
        fillOpacity: 0.12,
        weight: 1,
        opacity: 0.3,
      }).addTo(markersRef.current!);
    });

    reports.forEach((r) => {
      if (!r.latitude || !r.longitude) return;
      const color = categoryColors[r.category] ?? "#6b7280";
      const radius = severityWeight[r.severity] ?? 8;

      const marker = L.circleMarker([r.latitude, r.longitude], {
        radius,
        color: "#fff",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.9,
      });

      marker.bindPopup(`
        <div style="min-width:180px;font-family:system-ui,sans-serif">
          <p style="font-weight:700;font-size:13px;margin:0 0 4px">${r.title}</p>
          <p style="font-size:11px;color:#888;margin:0 0 6px">${r.address}</p>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <span style="background:${color}22;color:${color};border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;text-transform:capitalize">${r.category.replace("_", " ")}</span>
            <span style="background:#f3f4f6;color:#374151;border-radius:4px;padding:2px 8px;font-size:11px;text-transform:capitalize">${r.severity}</span>
          </div>
        </div>
      `);

      marker.on("click", () => setSelectedReport(r));
      marker.addTo(markersRef.current!);
    });
  }, [reports, points]);

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
    mapRef.current?.setView([lat, lng], 15);
    setSuggestions([]);
    setSearch(feat.properties.label);

    L.marker([lat, lng], {
      icon: L.divIcon({
        className: "",
        html: `<div style="background:#6366f1;width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
        iconAnchor: [7, 7],
      }),
    }).addTo(mapRef.current!);
  }

  function flyToReport(r: typeof reports[0]) {
    if (!r.latitude || !r.longitude) return;
    mapRef.current?.setView([r.latitude, r.longitude], 16);
    setSelectedReport(r);
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

          <div
            ref={containerRef}
            className="flex-1"
            style={{ height: "480px", zIndex: 0 }}
          />
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
                <button onClick={() => setSelectedReport(null)} className="text-muted-foreground hover:text-foreground shrink-0">
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
