import { useListRoads, getListRoadsQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Building2, Calendar, User, Award, AlertTriangle } from "lucide-react";

const roadTypeColors: Record<string, string> = {
  NH: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  SH: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  MDR: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  rural: "bg-green-500/15 text-green-400 border-green-500/30",
};

function QualityBar({ score }: { score: number }) {
  const color = score >= 75 ? "bg-green-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium w-7 text-right">{score}</span>
    </div>
  );
}

export default function Transparency() {
  const { data: roads, isLoading } = useListRoads({ query: { queryKey: getListRoadsQueryKey() } });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-serif)]">Road Transparency</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Public data on road quality, maintenance, and contractors</p>
      </div>

      {/* Summary */}
      {roads && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Segments", value: roads.length },
            { label: "Avg Quality", value: Math.round(roads.reduce((s, r) => s + r.qualityScore, 0) / (roads.length || 1)) + "/100" },
            { label: "NH Segments", value: roads.filter((r) => r.type === "NH").length },
            { label: "Poor Quality (<50)", value: roads.filter((r) => r.qualityScore < 50).length },
          ].map((s) => (
            <div key={s.label} className="p-4 rounded-xl border border-border bg-card text-center">
              <div className="text-2xl font-bold font-[family-name:var(--font-serif)] text-primary">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Road list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {roads?.map((road) => (
            <div data-testid={`card-road-${road.id}`} key={road.id} className="p-5 rounded-xl border border-border bg-card hover:border-primary/20 transition-colors">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{road.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge className={`text-xs border ${roadTypeColors[road.type] ?? ""}`}>{road.type}</Badge>
                      <span className="text-xs text-muted-foreground">{road.department}</span>
                    </div>
                  </div>
                </div>
                {road.qualityScore < 50 && (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                )}
              </div>

              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Road Quality Score</span>
                  <span className={`text-xs font-medium ${road.qualityScore >= 75 ? "text-green-400" : road.qualityScore >= 50 ? "text-amber-400" : "text-red-400"}`}>
                    {road.qualityScore >= 75 ? "Good" : road.qualityScore >= 50 ? "Fair" : "Poor"}
                  </span>
                </div>
                <QualityBar score={road.qualityScore} />
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span>Last maintained: <span className="text-foreground">{road.lastMaintained}</span></span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <User className="w-3 h-3" />
                  <span>Contractor: <span className="text-foreground">{road.contractorName}</span></span>
                </div>
                {road.tenderValue && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Award className="w-3 h-3" />
                    <span>Tender: <span className="text-foreground">₹{(road.tenderValue / 10000000).toFixed(1)} Cr</span></span>
                  </div>
                )}
                <div className="text-muted-foreground">
                  Lifespan: <span className="text-foreground">{road.estimatedLifespanYears} years</span>
                </div>
              </div>
            </div>
          ))}
          {!roads?.length && (
            <div className="p-8 text-center text-muted-foreground text-sm rounded-xl border border-border bg-card">
              No road data available
            </div>
          )}
        </div>
      )}
    </div>
  );
}
