import { useGetMyReports, getGetMyReportsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { StatusBadge, SeverityBadge, CategoryBadge } from "@/components/StatusBadge";
import { Plus, MapPin, Clock, FileText } from "lucide-react";

export default function MyReports() {
  const { data: reports, isLoading } = useGetMyReports({
    query: { queryKey: getGetMyReportsQueryKey() },
  });

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-serif)]">My Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{reports?.length ?? 0} reports filed by you</p>
        </div>
        <Link href="/reports/new">
          <Button size="sm" className="gap-2" data-testid="button-new-report">
            <Plus className="w-4 h-4" /> New Report
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : !reports?.length ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium mb-1">No reports yet</h3>
          <p className="text-sm text-muted-foreground mb-5">Help make your city safer by reporting road issues</p>
          <Link href="/reports/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> File Your First Report
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <Link key={r.id} href={`/reports/${r.id}`}>
              <div data-testid={`card-report-${r.id}`} className="p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-all cursor-pointer group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-sm group-hover:text-primary transition-colors truncate">{r.title}</h3>
                      <span className="text-xs text-muted-foreground font-mono shrink-0">{r.ticketId}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <StatusBadge status={r.status} />
                      <SeverityBadge severity={r.severity} />
                      <CategoryBadge category={r.category} />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{r.address}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    <div className="font-medium">{r.upvotes}</div>
                    <div>votes</div>
                  </div>
                </div>
                {r.status === "resolved" && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <p className="text-xs text-green-400">Resolved on {r.resolvedAt ? new Date(r.resolvedAt).toLocaleDateString("en-IN") : "—"}</p>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
