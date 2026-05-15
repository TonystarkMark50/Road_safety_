import {
  useGetDashboardSummary, useGetCategoryBreakdown, useGetResolutionTrends, useGetRecentActivity,
  useListReports, useUpdateReport,
  getGetDashboardSummaryQueryKey, getGetCategoryBreakdownQueryKey, getGetResolutionTrendsQueryKey,
  getGetRecentActivityQueryKey, getListReportsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import { StatusBadge, SeverityBadge, CategoryBadge } from "@/components/StatusBadge";
import { Link } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Shield, Activity, BarChart3, Clock } from "lucide-react";

const COLORS = ["#3b82f6", "#22c55e", "#f97316", "#eab308", "#a855f7", "#06b6d4", "#ef4444", "#6b7280"];

export default function Admin() {
  const qc = useQueryClient();
  const { data: summary } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: categories } = useGetCategoryBreakdown({ query: { queryKey: getGetCategoryBreakdownQueryKey() } });
  const { data: trends } = useGetResolutionTrends({ query: { queryKey: getGetResolutionTrendsQueryKey() } });
  const { data: activity } = useGetRecentActivity({ query: { queryKey: getGetRecentActivityQueryKey() } });
  const { data: reports } = useListReports({ params: { status: "submitted", limit: 10 }, options: { queryKey: getListReportsQueryKey({ status: "submitted" }) } });
  const updateReport = useUpdateReport();

  function handleStatusChange(id: number, status: string) {
    updateReport.mutate({ id, data: { status: status as any } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListReportsQueryKey() }),
    });
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-7">
        <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
          <Shield className="w-4.5 h-4.5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-serif)]">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Platform analytics and complaint management</p>
        </div>
      </div>

      {/* KPIs */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {[
            { label: "Total Reports", value: summary.totalReports, color: "text-blue-400" },
            { label: "Resolved", value: summary.resolvedReports, color: "text-green-400" },
            { label: "Pending", value: summary.pendingReports, color: "text-amber-400" },
            { label: "Resolution Rate", value: `${summary.resolutionRate}%`, color: "text-primary" },
            { label: "Avg Response", value: `${summary.avgResolutionHours}h`, color: "text-purple-400" },
          ].map((s) => (
            <div key={s.label} className="p-4 rounded-xl border border-border bg-card text-center">
              <div className={`text-2xl font-bold font-[family-name:var(--font-serif)] ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        {/* Category breakdown */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">Reports by Category</h2>
          </div>
          {categories && categories.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={categories} dataKey="count" nameKey="category" cx="50%" cy="50%" outerRadius={80} label={({ category, percentage }) => `${category.replace("_", " ")} (${percentage}%)`} labelLine={false} fontSize={10}>
                  {categories.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v, String(n).replace("_", " ")]} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
          )}
        </div>

        {/* Resolution trends */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">7-Day Resolution Trend</h2>
          </div>
          {trends && trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trends} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 35% 16%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(220 15% 55%)" }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(220 15% 55%)" }} />
                <Tooltip contentStyle={{ background: "hsl(222 40% 11%)", border: "1px solid hsl(222 35% 18%)", borderRadius: "8px" }} />
                <Line type="monotone" dataKey="reported" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 3 }} name="Reported" />
                <Line type="monotone" dataKey="resolved" stroke="#22c55e" strokeWidth={2} dot={{ fill: "#22c55e", r: 3 }} name="Resolved" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No trend data yet</div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Pending reports to manage */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="font-semibold text-sm">New Reports — Action Required</h2>
            <Link href="/reports"><Button variant="ghost" size="sm" className="text-xs">View all</Button></Link>
          </div>
          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {reports?.reports?.map((r) => (
              <div key={r.id} data-testid={`admin-report-${r.id}`} className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <Link href={`/reports/${r.id}`}>
                    <p className="text-sm font-medium hover:text-primary cursor-pointer transition-colors line-clamp-1">{r.title}</p>
                  </Link>
                  <SeverityBadge severity={r.severity} />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <CategoryBadge category={r.category} />
                  <StatusBadge status={r.status} />
                </div>
                <div className="flex gap-2 mt-2">
                  <Select onValueChange={(s) => handleStatusChange(r.id, s)}>
                    <SelectTrigger className="h-7 text-xs flex-1" data-testid={`select-status-${r.id}`}>
                      <SelectValue placeholder="Update status" />
                    </SelectTrigger>
                    <SelectContent>
                      {["under_review", "assigned", "in_progress", "resolved"].map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">{s.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
            {!reports?.reports?.length && (
              <div className="p-8 text-center text-muted-foreground text-sm">No new reports pending</div>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 p-5 border-b border-border">
            <Clock className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">Recent Activity</h2>
          </div>
          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {activity?.map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-5 py-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{a.message}</p>
                  {a.userName && <p className="text-xs text-muted-foreground/60 mt-0.5">by {a.userName}</p>}
                </div>
                <span className="text-xs text-muted-foreground/50 whitespace-nowrap">
                  {new Date(a.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              </div>
            ))}
            {!activity?.length && (
              <div className="p-8 text-center text-muted-foreground text-sm">No recent activity</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
