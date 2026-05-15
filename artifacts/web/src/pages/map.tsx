import { useGetHeatmapData, getGetHeatmapDataQueryKey, useListReports, getListReportsQueryKey } from "@workspace/api-client-react";
import { StatusBadge, SeverityBadge } from "@/components/StatusBadge";
import { MapPin, Layers, AlertCircle } from "lucide-react";
import { Link } from "wouter";

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

export default function MapView() {
  const { data: heatmap } = useGetHeatmapData({ query: { queryKey: getGetHeatmapDataQueryKey() } });
  const { data: reportsData } = useListReports({ params: { limit: 50 }, options: { queryKey: getListReportsQueryKey({ limit: 50 }) } });

  const reports = reportsData?.reports ?? [];
  const points = heatmap ?? [];

  // Compute bounds for normalization
  const lats = reports.map((r) => r.latitude).filter(Boolean);
  const lngs = reports.map((r) => r.longitude).filter(Boolean);
  const minLat = Math.min(...lats) || 28.45;
  const maxLat = Math.max(...lats) || 28.75;
  const minLng = Math.min(...lngs) || 77.0;
  const maxLng = Math.max(...lngs) || 77.4;

  function toXY(lat: number, lng: number, w: number, h: number) {
    const pad = 40;
    const x = pad + ((lng - minLng) / (maxLng - minLng || 1)) * (w - 2 * pad);
    const y = h - pad - ((lat - minLat) / (maxLat - minLat || 1)) * (h - 2 * pad);
    return { x, y };
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-serif)]">Road Issue Map</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Geographic visualization of reported road issues</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Map Canvas */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">New Delhi Region</span>
            </div>
            <span className="text-xs text-muted-foreground">{reports.length} active reports</span>
          </div>
          <svg
            viewBox="0 0 600 420"
            className="w-full"
            style={{ background: "hsl(222 40% 9%)" }}
          >
            {/* Grid lines */}
            {Array.from({ length: 6 }).map((_, i) => (
              <line key={`h${i}`} x1="40" y1={40 + i * 60} x2="560" y2={40 + i * 60} stroke="hsl(222 35% 16%)" strokeWidth="1" />
            ))}
            {Array.from({ length: 8 }).map((_, i) => (
              <line key={`v${i}`} x1={40 + i * 75} y1="40" x2={40 + i * 75} y2="380" stroke="hsl(222 35% 16%)" strokeWidth="1" />
            ))}

            {/* Heatmap circles */}
            {points.slice(0, 30).map((p, i) => {
              const { x, y } = toXY(p.latitude, p.longitude, 600, 420);
              const color = categoryColors[p.category] ?? "#6b7280";
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={Math.max(8, p.intensity * 30)}
                  fill={color}
                  fillOpacity={0.12 + p.intensity * 0.15}
                  stroke={color}
                  strokeOpacity={0.3}
                  strokeWidth="1"
                />
              );
            })}

            {/* Report markers */}
            {reports.map((r) => {
              const { x, y } = toXY(r.latitude, r.longitude, 600, 420);
              const color = categoryColors[r.category] ?? "#6b7280";
              return (
                <g key={r.id}>
                  <circle cx={x} cy={y} r="5" fill={color} fillOpacity="0.9" />
                  <circle cx={x} cy={y} r="9" fill={color} fillOpacity="0.2" />
                </g>
              );
            })}

            {/* Labels */}
            <text x="300" y="410" textAnchor="middle" fill="hsl(220 15% 46%)" fontSize="10">
              New Delhi, India — Reported Issues Map
            </text>
          </svg>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Legend */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> Legend
            </h3>
            <div className="space-y-2">
              {Object.entries(categoryColors).map(([cat, color]) => (
                <div key={cat} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-xs text-muted-foreground capitalize">{cat.replace("_", " ")}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top issues */}
          <div className="rounded-xl border border-border bg-card">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                High Priority Issues
              </h3>
            </div>
            <div className="divide-y divide-border max-h-64 overflow-y-auto">
              {reports.filter((r) => r.severity === "critical" || r.severity === "high").slice(0, 6).map((r) => (
                <Link key={r.id} href={`/reports/${r.id}`}>
                  <div data-testid={`map-report-${r.id}`} className="p-3 hover:bg-muted/40 cursor-pointer transition-colors">
                    <p className="text-xs font-medium truncate mb-1">{r.title}</p>
                    <div className="flex gap-1">
                      <StatusBadge status={r.status} />
                      <SeverityBadge severity={r.severity} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5" />{r.address.split(",")[0]}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
