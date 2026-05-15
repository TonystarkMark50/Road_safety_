import { useGetBudgetOverview, useListBudgetProjects, getGetBudgetOverviewQueryKey, getListBudgetProjectsQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Building2, CheckCircle2 } from "lucide-react";

const statusColors: Record<string, string> = {
  planned: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  in_progress: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  completed: "bg-green-500/15 text-green-400 border-green-500/30",
  delayed: "bg-red-500/15 text-red-400 border-red-500/30",
};

function formatCrore(v: number) {
  return `₹${(v / 10000000).toFixed(1)} Cr`;
}

export default function Budget() {
  const { data: overview, isLoading: ovLoading } = useGetBudgetOverview({
    query: { queryKey: getGetBudgetOverviewQueryKey() },
  });
  const { data: projects, isLoading: projLoading } = useListBudgetProjects({
    query: { queryKey: getListBudgetProjectsQueryKey() },
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-serif)]">Budget Transparency</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Public infrastructure spending and project timelines</p>
      </div>

      {/* Overview cards */}
      {ovLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-xl border border-border bg-card animate-pulse" />)}
        </div>
      ) : overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-muted-foreground">Sanctioned</span>
            </div>
            <div className="text-xl font-bold font-[family-name:var(--font-serif)] text-blue-400">{formatCrore(overview.totalSanctioned)}</div>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-muted-foreground">Spent</span>
            </div>
            <div className="text-xl font-bold font-[family-name:var(--font-serif)] text-amber-400">{formatCrore(overview.totalSpent)}</div>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-green-400" />
              <span className="text-xs text-muted-foreground">Remaining</span>
            </div>
            <div className="text-xl font-bold font-[family-name:var(--font-serif)] text-green-400">{formatCrore(overview.totalRemaining)}</div>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Projects</span>
            </div>
            <div className="text-xl font-bold font-[family-name:var(--font-serif)] text-primary">{overview.completedProjects}/{overview.projectCount}</div>
            <div className="text-xs text-muted-foreground">completed</div>
          </div>
        </div>
      )}

      {overview && (
        <div className="rounded-xl border border-border bg-card p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Overall Budget Utilization</span>
            <span className="text-sm font-bold text-primary">{overview.utilizationRate}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${overview.utilizationRate}%` }} />
          </div>
        </div>
      )}

      {/* Projects */}
      <h2 className="text-lg font-semibold font-[family-name:var(--font-serif)] mb-4">Active Projects</h2>
      {projLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 rounded-xl border border-border bg-card animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {projects?.map((p) => {
            const utilization = p.sanctionedAmount > 0 ? (p.spentAmount / p.sanctionedAmount) * 100 : 0;
            return (
              <div data-testid={`card-project-${p.id}`} key={p.id} className="p-5 rounded-xl border border-border bg-card hover:border-primary/20 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-semibold text-sm">{p.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.department} • {p.contractorName}</p>
                  </div>
                  <Badge className={`text-xs border shrink-0 ${statusColors[p.status] ?? ""}`}>
                    {p.status.replace("_", " ")}
                  </Badge>
                </div>

                <div className="grid sm:grid-cols-3 gap-4 mb-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Sanctioned</span>
                    <div className="font-semibold mt-0.5">{formatCrore(p.sanctionedAmount)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Spent</span>
                    <div className="font-semibold mt-0.5 text-amber-400">{formatCrore(p.spentAmount)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Timeline</span>
                    <div className="font-semibold mt-0.5">{p.startDate} → {p.endDate}</div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1 text-xs">
                    <span className="text-muted-foreground">Utilization</span>
                    <span className="font-medium">{utilization.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${utilization > 90 ? "bg-green-500" : utilization > 50 ? "bg-amber-500" : "bg-blue-500"}`}
                      style={{ width: `${Math.min(utilization, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
