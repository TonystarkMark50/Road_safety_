import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import {
  MapPin, Layers, AlertCircle, Search, X, Navigation,
  Plus, ChevronDown, ChevronUp, ThumbsUp, Camera, Loader2
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* ─── Constants ─────────────────────────────────────────────────── */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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

const SEVERITY_RADIUS: Record<string, number> = { critical: 14, high: 11, medium: 9, low: 7 };

type Report = {
  id: number; ticketId: string; title: string; category: string;
  description: string; status: string; latitude: number | null;
  longitude: number | null; address: string; severity: string;
  upvotes: number; createdAt: string; userName?: string;
};

/* ─── Helpers ────────────────────────────────────────────────────── */

function makeIcon(category: string, severity: string) {
  const color = CATEGORY_COLORS[category] ?? "#9ca3af";
  const r = SEVERITY_RADIUS[severity] ?? 9;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${r * 2 + 4}" height="${r * 2 + 4}">
    <circle cx="${r + 2}" cy="${r + 2}" r="${r}" fill="${color}" fill-opacity="0.92" stroke="#fff" stroke-width="2"/>
  </svg>`;
  return L.divIcon({
    className: "",
    html: svg,
    iconAnchor: [r + 2, r + 2],
    popupAnchor: [0, -(r + 4)],
  });
}

function categoryLabel(cat: string) {
  return CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

function severityColor(s: string) {
  return { critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#22c55e" }[s] ?? "#6b7280";
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

async function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${BASE}${path}`, { credentials: "include", ...opts });
}

/* ─── Main Component ─────────────────────────────────────────────── */

export default function MapView() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<number, L.CircleMarker | L.Marker>>(new Map());
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<{ label: string; lat: number; lng: number }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [showHigh, setShowHigh] = useState(true);

  const [form, setForm] = useState({
    title: "", category: "pothole", description: "",
    severity: "medium", latitude: "", longitude: "", address: "",
  });

  /* ── Map init ── */
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [28.6139, 77.209],
      zoom: 12,
      zoomControl: false,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }
    ).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  /* ── Load & refresh reports ── */
  const loadReports = useCallback(async () => {
    try {
      const r = await apiFetch("/api/reports?limit=100");
      if (!r.ok) return;
      const data = await r.json();
      setReports(data.reports ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadReports();
    const id = setInterval(loadReports, 30_000);
    return () => clearInterval(id);
  }, [loadReports]);

  /* ── Render markers when reports or filter changes ── */
  useEffect(() => {
    if (!layerGroupRef.current) return;
    layerGroupRef.current.clearLayers();
    markersRef.current.clear();

    const filtered = filterCat === "all" ? reports : reports.filter((r) => r.category === filterCat);

    filtered.forEach((r) => {
      if (!r.latitude || !r.longitude) return;

      const marker = L.marker([r.latitude, r.longitude], {
        icon: makeIcon(r.category, r.severity),
      });

      const color = CATEGORY_COLORS[r.category] ?? "#9ca3af";
      const sColor = severityColor(r.severity);

      marker.bindPopup(
        `<div style="min-width:200px;font-family:system-ui,sans-serif;color:#e2e8f0;background:#1e293b;padding:2px">
          <div style="font-weight:700;font-size:13px;margin-bottom:4px;line-height:1.3">${r.title}</div>
          <div style="font-size:11px;color:#94a3b8;margin-bottom:6px">${r.address}</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px">
            <span style="background:${color}25;color:${color};border-radius:4px;padding:2px 8px;font-size:10px;font-weight:600;text-transform:capitalize">${categoryLabel(r.category)}</span>
            <span style="background:${sColor}22;color:${sColor};border-radius:4px;padding:2px 8px;font-size:10px;font-weight:600;text-transform:capitalize">${r.severity}</span>
            <span style="background:#334155;color:#94a3b8;border-radius:4px;padding:2px 8px;font-size:10px;text-transform:capitalize">${r.status.replace("_", " ")}</span>
          </div>
          <div style="font-size:11px;color:#94a3b8;margin-bottom:8px">${r.description.slice(0, 100)}${r.description.length > 100 ? "…" : ""}</div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:10px;color:#64748b">${timeAgo(r.createdAt)} · ${r.userName ?? "Anonymous"}</span>
            <span style="font-size:10px;color:#64748b">▲ ${r.upvotes}</span>
          </div>
        </div>`,
        {
          maxWidth: 260,
          className: "dark-popup",
        }
      );

      marker.on("click", () => setSelectedReport(r));
      marker.addTo(layerGroupRef.current!);
      markersRef.current.set(r.id, marker);
    });
  }, [reports, filterCat]);

  /* ── Geocode search ── */
  async function handleSearch(q: string) {
    setSearch(q);
    if (!q.trim()) { setSuggestions([]); return; }
    setSearching(true);
    try {
      const r = await apiFetch(`/api/map/geocode?q=${encodeURIComponent(q)}`);
      const data = await r.json();
      setSuggestions(
        (data.features ?? []).map((f: { properties: { label: string }; geometry: { coordinates: [number, number] } }) => ({
          label: f.properties.label,
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0],
        }))
      );
    } catch { setSuggestions([]); }
    finally { setSearching(false); }
  }

  function selectSuggestion(s: { label: string; lat: number; lng: number }) {
    mapRef.current?.setView([s.lat, s.lng], 15);
    setSearch(s.label);
    setSuggestions([]);
  }

  /* ── Geolocation ── */
  function captureLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setForm((f) => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }));
        mapRef.current?.setView([lat, lng], 15);
        try {
          const r = await apiFetch(`/api/map/geocode?q=${lat},${lng}`);
          const data = await r.json();
          const label = data.features?.[0]?.properties?.label ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          setForm((f) => ({ ...f, address: label }));
        } catch { setForm((f) => ({ ...f, address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` })); }
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true }
    );
  }

  /* ── Submit report ── */
  async function submitReport() {
    if (!form.title || !form.address) return;
    setSubmitting(true);
    try {
      const body = {
        title: form.title,
        category: form.category,
        description: form.description || "No description provided.",
        severity: form.severity,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        address: form.address,
      };
      const r = await apiFetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        setSubmitSuccess(true);
        setShowForm(false);
        setForm({ title: "", category: "pothole", description: "", severity: "medium", latitude: "", longitude: "", address: "" });
        setTimeout(() => { setSubmitSuccess(false); loadReports(); }, 2000);
      }
    } finally { setSubmitting(false); }
  }

  function flyToReport(r: Report) {
    if (!r.latitude || !r.longitude) return;
    mapRef.current?.setView([r.latitude, r.longitude], 16);
    setSelectedReport(r);
    const m = markersRef.current.get(r.id);
    if (m) m.openPopup();
  }

  const highPriority = reports.filter((r) => r.severity === "critical" || r.severity === "high");

  /* ─── JSX ─── */
  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-serif)]">Live Road Issue Map</h1>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live · {reports.length} reports tracked · refreshes every 30s
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-lg"
        >
          <Plus className="w-4 h-4" />
          Report Issue
        </button>
      </div>

      {/* Success toast */}
      {submitSuccess && (
        <div className="mb-3 px-4 py-3 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 text-sm font-medium">
          Issue reported successfully — it will appear on the map shortly.
        </div>
      )}

      {/* Report Form */}
      {showForm && (
        <div className="mb-4 rounded-xl border border-border bg-card p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-primary" /> Report a Road Issue
            </h2>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Issue Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Large pothole on MG Road"
                className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Severity</label>
              <select
                value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
                className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Location *</label>
              <div className="flex gap-2">
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Address or landmark"
                  className="flex-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={captureLocation}
                  disabled={locating}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-muted/40 text-xs text-foreground hover:bg-muted/70 transition-colors disabled:opacity-50"
                >
                  {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                  Use GPS
                </button>
              </div>
              {form.latitude && (
                <p className="text-xs text-muted-foreground mt-1">
                  📍 {parseFloat(form.latitude).toFixed(5)}, {parseFloat(form.longitude).toFixed(5)}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe the issue in detail…"
                rows={2}
                className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={submitReport}
              disabled={submitting || !form.title || !form.address}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              Submit Report
            </button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Map */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-[#0f172a] overflow-hidden shadow-xl" style={{ position: "relative" }}>

          {/* Map canvas — full height */}
          <div ref={mapContainerRef} style={{ height: 540 }} />

          {/* ── Floating search pill (Google Maps style) ── */}
          <div style={{
            position: "absolute", top: 14, left: 14, right: 14, zIndex: 9000,
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "rgba(15,23,42,0.95)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1.5px solid rgba(255,255,255,0.1)",
              borderRadius: 32, padding: "10px 16px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
            }}>
              <Search style={{ width: 16, height: 16, color: searching ? "#3b82f6" : "#64748b", flexShrink: 0 }} />
              <input
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search any location on map…"
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  fontSize: 14, color: "#e2e8f0", minWidth: 0,
                }}
                onFocus={(e) => {
                  (e.currentTarget.parentElement as HTMLElement).style.borderColor = "rgba(59,130,246,0.5)";
                  (e.currentTarget.parentElement as HTMLElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.5), 0 0 0 3px rgba(59,130,246,0.15)";
                }}
                onBlur={(e) => {
                  (e.currentTarget.parentElement as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)";
                  (e.currentTarget.parentElement as HTMLElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)";
                }}
              />
              {searching && (
                <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #3b82f6", borderTopColor: "transparent", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
              )}
              {search && !searching && (
                <button
                  onClick={() => { setSearch(""); setSuggestions([]); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }}
                >
                  <X style={{ width: 14, height: 14, color: "#64748b" }} />
                </button>
              )}
              {/* Divider + filter */}
              <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.1)", flexShrink: 0, margin: "0 2px" }} />
              <select
                value={filterCat}
                onChange={(e) => setFilterCat(e.target.value)}
                style={{
                  background: "transparent", border: "none", outline: "none",
                  color: "#94a3b8", fontSize: 12, cursor: "pointer", flexShrink: 0,
                }}
              >
                <option value="all" style={{ background: "#1e293b" }}>All</option>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value} style={{ background: "#1e293b" }}>{c.label}</option>)}
              </select>
            </div>

            {/* Suggestions dropdown */}
            {(suggestions.length > 0 || searching) && (
              <div style={{
                marginTop: 6,
                background: "rgba(15,23,42,0.97)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 18, overflow: "hidden",
                boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
              }}>
                {searching && suggestions.length === 0 && (
                  <p style={{ padding: "10px 16px", fontSize: 12, color: "#64748b", margin: 0 }}>Searching…</p>
                )}
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => selectSuggestion(s)}
                    style={{
                      width: "100%", textAlign: "left", display: "flex", alignItems: "center",
                      gap: 10, padding: "10px 16px",
                      background: "transparent", border: "none",
                      borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none",
                      cursor: "pointer", transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                      background: "rgba(59,130,246,0.12)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <MapPin style={{ width: 13, height: 13, color: "#3b82f6" }} />
                    </div>
                    <span style={{ fontSize: 13, color: "#cbd5e1", flex: 1, lineHeight: 1.4 }}>{s.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Legend strip */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: "rgba(15,23,42,0.9)",
            backdropFilter: "blur(8px)",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            padding: "8px 14px", zIndex: 8000, display: "flex", gap: 14, flexWrap: "wrap",
          }}>
            {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
              <button
                key={cat}
                onClick={() => setFilterCat(filterCat === cat ? "all" : cat)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  background: "none", border: "none", cursor: "pointer",
                  opacity: filterCat !== "all" && filterCat !== cat ? 0.35 : 1,
                  transition: "opacity 0.15s",
                  padding: 0,
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: "#64748b", textTransform: "capitalize" }}>{cat.replace("_", " ")}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Selected report card */}
          {selectedReport && (
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 shadow-lg">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-xs text-muted-foreground font-mono">{selectedReport.ticketId}</p>
                  <h3 className="text-sm font-semibold text-foreground leading-tight mt-0.5">{selectedReport.title}</h3>
                </div>
                <button onClick={() => setSelectedReport(null)} className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" />{selectedReport.address}
              </p>
              <div className="flex flex-wrap gap-1 mb-2">
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold capitalize"
                  style={{ background: `${CATEGORY_COLORS[selectedReport.category]}22`, color: CATEGORY_COLORS[selectedReport.category] }}>
                  {categoryLabel(selectedReport.category)}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold capitalize"
                  style={{ background: `${severityColor(selectedReport.severity)}22`, color: severityColor(selectedReport.severity) }}>
                  {selectedReport.severity}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                  {selectedReport.status.replace("_", " ")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{selectedReport.description}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ThumbsUp className="w-3 h-3" /> {selectedReport.upvotes} upvotes
                </div>
                <Link href={`/reports/${selectedReport.id}`}>
                  <span className="text-xs text-primary font-medium hover:underline">Full report →</span>
                </Link>
              </div>
            </div>
          )}

          {/* High Priority */}
          <div className="rounded-xl border border-border bg-card shadow">
            <button
              className="w-full p-4 border-b border-border flex items-center justify-between"
              onClick={() => setShowHigh((s) => !s)}
            >
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                High Priority
                <span className="text-xs bg-red-500/20 text-red-400 rounded-full px-2 py-0.5 font-mono">
                  {highPriority.length}
                </span>
              </h3>
              {showHigh ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {showHigh && (
              <div className="divide-y divide-border/60 max-h-64 overflow-y-auto">
                {highPriority.slice(0, 10).map((r) => (
                  <button key={r.id} onClick={() => flyToReport(r)}
                    className="w-full p-3 hover:bg-muted/40 transition-colors text-left group">
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ background: CATEGORY_COLORS[r.category] ?? "#9ca3af" }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">{r.title}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{r.address.split(",")[0]}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-semibold capitalize"
                            style={{ color: severityColor(r.severity) }}>{r.severity}</span>
                          <span className="text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
                {highPriority.length === 0 && (
                  <p className="text-xs text-muted-foreground p-4 text-center">No high priority issues right now</p>
                )}
              </div>
            )}
          </div>

          {/* Recent reports */}
          <div className="rounded-xl border border-border bg-card shadow">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" /> Recent Reports
              </h3>
            </div>
            <div className="divide-y divide-border/60 max-h-72 overflow-y-auto">
              {reports.slice(0, 12).map((r) => (
                <button key={r.id} onClick={() => flyToReport(r)}
                  className="w-full p-3 hover:bg-muted/40 transition-colors text-left group">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                      style={{ background: CATEGORY_COLORS[r.category] ?? "#9ca3af" }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">{r.title}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{r.address.split(",")[0]}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(r.createdAt)}</p>
                    </div>
                    <Navigation className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                  </div>
                </button>
              ))}
              {reports.length === 0 && (
                <p className="text-xs text-muted-foreground p-4 text-center">No reports yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Popup dark style injection */}
      <style>{`
        .dark-popup .leaflet-popup-content-wrapper {
          background: #1e293b;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          color: #e2e8f0;
          box-shadow: 0 20px 40px rgba(0,0,0,0.5);
          padding: 0;
        }
        .dark-popup .leaflet-popup-content {
          margin: 12px 14px;
        }
        .dark-popup .leaflet-popup-tip {
          background: #1e293b;
        }
        .dark-popup .leaflet-popup-close-button {
          color: #64748b !important;
        }
        .dark-popup .leaflet-popup-close-button:hover {
          color: #e2e8f0 !important;
        }
      `}</style>
    </div>
  );
}
