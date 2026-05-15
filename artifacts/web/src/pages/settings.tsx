import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useListNotifications, useMarkNotificationRead, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Shield, Bell, User, Mail, Phone, CheckCheck } from "lucide-react";

export default function Settings() {
  const { user, clearAuth } = useAuth();
  const qc = useQueryClient();
  const { data: notifications } = useListNotifications({ query: { queryKey: getListNotificationsQueryKey() } });
  const markRead = useMarkNotificationRead();

  function handleMarkRead(id: number) {
    markRead.mutate({ id }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() }),
    });
  }

  const roleLabels: Record<string, string> = {
    citizen: "Citizen",
    admin: "Administrator",
    authority: "Government Authority",
    emergency: "Emergency Services",
  };

  const unread = notifications?.filter((n) => !n.isRead) ?? [];

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-serif)]">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your account and notification preferences</p>
      </div>

      {/* Profile */}
      <div className="rounded-xl border border-border bg-card p-6 mb-5">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-primary" /> Profile
        </h2>
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold" data-testid="text-username">{user?.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge className="text-xs capitalize">{roleLabels[user?.role ?? ""] ?? user?.role}</Badge>
              {user?.isVerified && (
                <Badge className="text-xs bg-green-500/15 text-green-400 border-green-500/30 border">Verified</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <span data-testid="text-email">{user?.email}</span>
          </div>
          {user?.phone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span>{user.phone}</span>
            </div>
          )}
          <div className="flex items-center gap-3 text-sm">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">{user?.reportsCount} reports filed</span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-xl border border-border bg-card mb-5">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Notifications</h2>
            {unread.length > 0 && (
              <Badge className="text-xs bg-primary/20 text-primary border-primary/30 border">{unread.length} unread</Badge>
            )}
          </div>
          {unread.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => unread.forEach((n) => handleMarkRead(n.id))}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </Button>
          )}
        </div>
        <div className="divide-y divide-border max-h-80 overflow-y-auto">
          {notifications?.map((n) => (
            <div
              key={n.id}
              data-testid={`notification-${n.id}`}
              onClick={() => !n.isRead && handleMarkRead(n.id)}
              className={`p-4 cursor-pointer hover:bg-muted/40 transition-colors ${!n.isRead ? "bg-primary/5" : ""}`}
            >
              <div className="flex items-start gap-3">
                {!n.isRead && <div className="w-2 h-2 rounded-full bg-primary mt-1 shrink-0" />}
                <div className={!n.isRead ? "" : "pl-5"}>
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {new Date(n.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {!notifications?.length && (
            <div className="p-8 text-center text-muted-foreground text-sm">No notifications yet</div>
          )}
        </div>
      </div>

      {/* Account actions */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold mb-4">Account</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">Sign out of your account</p>
            <p className="text-xs text-muted-foreground mt-0.5">You can sign back in at any time</p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={clearAuth}
            data-testid="button-signout"
          >
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
