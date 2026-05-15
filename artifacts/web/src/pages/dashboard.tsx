import { useAuth } from "@/contexts/AuthContext";
import {
  useGetDashboardSummary,
  useGetRecentActivity,
  useListReports,
  useListNotifications,
  useMarkNotificationRead,
  getGetDashboardSummaryQueryKey,
  getGetRecentActivityQueryKey,
  getListNotificationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { StatusBadge, SeverityBadge, CategoryBadge } from "@/components/StatusBadge";
import {
  FileText, AlertCircle, CheckCircle2, Clock, Activity, Bell, Plus, TrendingUp, Users, Zap
} from "lucide-react";

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="p-5 rounded-xl border border-border bg-card hover:border-primary/20 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
      <div className="text-2xl font-bold font-[family-name:var(--font-serif)] mb-0.5">{value}</div>
      <div className="text-sm font-medium text-foreground/80">{label}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: summary, isLoading: sumLoading } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() },
  });
  const { data: activity } = useGetRecentActivity({
    query: { queryKey: getGetRecentActivityQueryKey() },
  });
  const { data: reports } = useListReports({ params: { limit: 5 } });
  const { data: notifications } = useListNotifications();
  const markRead = useMarkNotificationRead();

  const unread = notifications?.filter((n) => !n.isRead) ?? [];

  function handleMarkRead(id: number) {
    markRead.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      },
    });
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-serif)]">
            Welcome back, {user?.name?.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 capitalize">
            {user?.role} — {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <Link href="/reports/new">
          <Button size="sm" className="gap-2" data-testid="button-new-report">
            <Plus className="w-4 h-4" />
            File Report
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        {sumLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl border border-border bg-card animate-pulse" />
          ))
        ) : (
          <>
            <StatCard icon={FileText} label="Total Reports" value={summary?.totalReports ?? 0} sub="Platform-wide" color="bg-blue-500/15 text-blue-400" />
            <StatCard icon={CheckCircle2} label="Resolved" value={summary?.resolvedReports ?? 0} sub={`${summary?.resolutionRate ?? 0}% rate`} color="bg-green-500/15 text-green-400" />
            <StatCard icon={Clock} label="Pending" value={summary?.pendingReports ?? 0} sub="Need attention" color="bg-amber-500/15 text-amber-400" />
            <StatCard icon={AlertCircle} label="Active SOS" value={summary?.activeEmergencies ?? 0} sub="Live emergencies" color="bg-red-500/15 text-red-400" />
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Recent Reports */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <h2 className="font-semibold">Recent Reports</h2>
            </div>
            <Link href="/reports">
              <Button variant="ghost" size="sm" className="text-xs">View all</Button>
            </Link>
          </div>
          <div className="divide-y divide-border">
            {reports?.reports?.slice(0, 5).map((r) => (
              <Link key={r.id} href={`/reports/${r.id}`}>
                <div data-testid={`card-report-${r.id}`} className="flex items-start gap-3 p-4 hover:bg-muted/40 transition-colors cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium truncate">{r.title}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={r.status} />
                      <SeverityBadge severity={r.severity} />
                      <span className="text-xs text-muted-foreground">{r.ticketId}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{r.address}</p>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap pt-0.5">{r.upvotes} votes</div>
                </div>
              </Link>
            ))}
            {!reports?.reports?.length && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No reports yet. <Link href="/reports/new" className="text-primary">File the first one</Link>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Quick Actions
            </h2>
            <div className="space-y-2">
              <Link href="/reports/new">
                <Button variant="outline" className="w-full justify-start gap-2 text-sm" size="sm">
                  <Plus className="w-4 h-4" /> File Road Report
                </Button>
              </Link>
              <Link href="/emergency">
                <Button variant="outline" className="w-full justify-start gap-2 text-sm border-red-500/30 text-red-400 hover:bg-red-500/10" size="sm">
                  <AlertCircle className="w-4 h-4" /> Emergency SOS
                </Button>
              </Link>
              <Link href="/my-reports">
                <Button variant="outline" className="w-full justify-start gap-2 text-sm" size="sm">
                  <FileText className="w-4 h-4" /> My Reports
                </Button>
              </Link>
            </div>
          </div>

          {/* Notifications */}
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-sm">Notifications</h2>
                {unread.length > 0 && (
                  <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">{unread.length}</span>
                )}
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-border">
              {(notifications ?? []).slice(0, 5).map((n) => (
                <div
                  key={n.id}
                  data-testid={`notification-${n.id}`}
                  onClick={() => !n.isRead && handleMarkRead(n.id)}
                  className={`p-3 cursor-pointer hover:bg-muted/40 transition-colors ${!n.isRead ? "bg-primary/5" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.isRead && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    </div>
                  </div>
                </div>
              ))}
              {!notifications?.length && (
                <div className="p-4 text-xs text-muted-foreground text-center">No notifications</div>
              )}
            </div>
          </div>

          {/* Platform Metrics */}
          {summary && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-sm">Platform Metrics</h2>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Total Citizens</span>
                  <span className="font-medium">{summary.totalCitizens}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Resolution Rate</span>
                  <span className="font-medium text-green-400">{summary.resolutionRate}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Avg Response Time</span>
                  <span className="font-medium">{summary.avgResolutionHours}h</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Top Issue</span>
                  <span className="font-medium capitalize">{summary.topCategory?.replace("_", " ")}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      {activity && activity.length > 0 && (
        <div className="mt-5 rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 p-5 border-b border-border">
            <Activity className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Recent Activity</h2>
          </div>
          <div className="divide-y divide-border">
            {activity.slice(0, 6).map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                <p className="text-sm text-muted-foreground flex-1">{a.message}</p>
                <span className="text-xs text-muted-foreground/60 whitespace-nowrap">
                  {new Date(a.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
