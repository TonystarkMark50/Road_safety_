import { useRoute, Link } from "wouter";
import { useGetReport, useUpdateReport, useUpvoteReport, getGetReportQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, SeverityBadge, CategoryBadge } from "@/components/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, MapPin, Clock, ThumbsUp, User, Shield } from "lucide-react";
import { useState } from "react";

const statusFlow = ["submitted", "under_review", "assigned", "in_progress", "resolved"];

export default function ReportDetail() {
  const [, params] = useRoute("/reports/:id");
  const id = parseInt(params?.id ?? "0", 10);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newStatus, setNewStatus] = useState("");

  const { data: report, isLoading } = useGetReport(id, {
    query: { enabled: !!id, queryKey: getGetReportQueryKey(id) },
  });
  const updateReport = useUpdateReport();
  const upvote = useUpvoteReport();

  function handleStatusUpdate() {
    if (!newStatus) return;
    updateReport.mutate({ id, data: { status: newStatus as any } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetReportQueryKey(id) });
        setNewStatus("");
      },
    });
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="h-96 rounded-xl border border-border bg-card animate-pulse" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Report not found</p>
        <Link href="/reports"><Button variant="link">Back to Reports</Button></Link>
      </div>
    );
  }

  const statusIndex = statusFlow.indexOf(report.status);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/reports">
        <Button variant="ghost" size="sm" className="gap-2 mb-5 -ml-2 text-muted-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Reports
        </Button>
      </Link>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h1 className="text-xl font-bold font-[family-name:var(--font-serif)] leading-tight">{report.title}</h1>
            <button
              data-testid="button-upvote"
              onClick={() => upvote.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetReportQueryKey(id) }) })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/10 transition-all text-muted-foreground hover:text-primary shrink-0"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              <span className="text-sm font-medium">{report.upvotes}</span>
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <StatusBadge status={report.status} />
            <SeverityBadge severity={report.severity} />
            <CategoryBadge category={report.category} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4 shrink-0" />
              {report.address}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4 shrink-0" />
              {new Date(report.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </div>
            {report.userName && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="w-4 h-4 shrink-0" />
                {report.userName}
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="w-4 h-4 shrink-0" />
              Ticket: <span className="font-mono text-xs text-foreground">{report.ticketId}</span>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="p-6 border-b border-border">
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Description</h2>
          <p className="text-sm leading-relaxed">{report.description}</p>
          {report.adminNote && (
            <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-xs font-semibold text-primary mb-1">Authority Note</p>
              <p className="text-sm">{report.adminNote}</p>
            </div>
          )}
        </div>

        {/* Status Timeline */}
        <div className="p-6 border-b border-border">
          <h2 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">Status Timeline</h2>
          <div className="flex items-center gap-1 flex-wrap">
            {statusFlow.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  i < statusIndex ? "bg-green-500/15 text-green-400 border-green-500/30" :
                  i === statusIndex ? "bg-primary/20 text-primary border-primary/30 shadow-sm" :
                  "bg-muted/40 text-muted-foreground border-border"
                }`}>
                  {i < statusIndex && <span>✓</span>}
                  {s.replace("_", " ")}
                </div>
                {i < statusFlow.length - 1 && <div className="w-4 h-px bg-border" />}
              </div>
            ))}
          </div>
        </div>

        {/* Location */}
        <div className="p-6 border-b border-border">
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Location</h2>
          <div className="h-32 rounded-lg bg-muted/30 border border-border flex items-center justify-center text-muted-foreground text-sm">
            <div className="text-center">
              <MapPin className="w-6 h-6 mx-auto mb-1 text-primary" />
              <p>{report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}</p>
              <p className="text-xs">{report.address}</p>
            </div>
          </div>
        </div>

        {/* Admin Actions */}
        {(user?.role === "admin" || user?.role === "authority") && (
          <div className="p-6">
            <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Update Status</h2>
            <div className="flex gap-3">
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="flex-1" data-testid="select-new-status">
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent>
                  {statusFlow.filter((s) => s !== report.status).map((s) => (
                    <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleStatusUpdate}
                disabled={!newStatus || updateReport.isPending}
                data-testid="button-update-status"
              >
                Update
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
