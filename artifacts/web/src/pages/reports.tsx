import { useState } from "react";
import {
  useListReports, useUpvoteReport, getListReportsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, SeverityBadge, CategoryBadge } from "@/components/StatusBadge";
import { ThumbsUp, Search, Plus, MapPin, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const statusOptions = ["all", "submitted", "under_review", "assigned", "in_progress", "resolved"];
const categoryOptions = ["all", "pothole", "road_damage", "accident", "waterlogging", "signal_failure", "illegal_parking", "congestion"];

export default function Reports() {
  const { user } = useAuth();
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const upvote = useUpvoteReport();

  const params = {
    status: status !== "all" ? status : undefined,
    category: category !== "all" ? category : undefined,
    page,
    limit: 15,
  };

  const { data, isLoading } = useListReports({ params, options: { queryKey: getListReportsQueryKey(params) } });

  function handleUpvote(e: React.MouseEvent, id: number) {
    e.preventDefault();
    upvote.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
      },
    });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-serif)]">All Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data?.total ?? 0} reports total
          </p>
        </div>
        <Link href="/reports/new">
          <Button size="sm" className="gap-2" data-testid="button-new-report">
            <Plus className="w-4 h-4" /> File Report
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-40" data-testid="select-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((s) => (
              <SelectItem key={s} value={s}>{s === "all" ? "All Statuses" : s.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
          <SelectTrigger className="w-44" data-testid="select-category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categoryOptions.map((c) => (
              <SelectItem key={c} value={c}>{c === "all" ? "All Categories" : c.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {data?.reports?.map((r) => (
            <Link key={r.id} href={`/reports/${r.id}`}>
              <div data-testid={`card-report-${r.id}`} className="p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-all cursor-pointer group">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-medium text-sm group-hover:text-primary transition-colors">{r.title}</h3>
                      <span className="text-xs text-muted-foreground font-mono">{r.ticketId}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <StatusBadge status={r.status} />
                      <SeverityBadge severity={r.severity} />
                      <CategoryBadge category={r.category} />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{r.address}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      {r.userName && <span>by {r.userName}</span>}
                    </div>
                  </div>
                  <button
                    data-testid={`button-upvote-${r.id}`}
                    onClick={(e) => handleUpvote(e, r.id)}
                    className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/10 transition-all text-muted-foreground hover:text-primary"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">{r.upvotes}</span>
                  </button>
                </div>
              </div>
            </Link>
          ))}
          {!data?.reports?.length && (
            <div className="p-12 text-center rounded-xl border border-border bg-card">
              <Search className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No reports match your filters</p>
              <Button variant="link" className="text-primary text-sm mt-2" onClick={() => { setStatus("all"); setCategory("all"); }}>
                Clear filters
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {data && data.total > 15 && (
        <div className="flex items-center justify-between mt-5">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, data.total)} of {data.total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page * 15 >= data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
