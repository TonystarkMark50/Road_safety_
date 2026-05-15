import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard, FileText, Plus, AlertCircle, Map, Building2,
  DollarSign, Bell, Settings, LogOut, Shield, Menu, X, ChevronRight
} from "lucide-react";
import { useState } from "react";
import { useListNotifications } from "@workspace/api-client-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["citizen", "admin", "authority", "emergency"] },
  { label: "Reports", href: "/reports", icon: FileText, roles: ["citizen", "admin", "authority", "emergency"] },
  { label: "File Report", href: "/reports/new", icon: Plus, roles: ["citizen", "admin"] },
  { label: "My Reports", href: "/my-reports", icon: FileText, roles: ["citizen"] },
  { label: "Emergency", href: "/emergency", icon: AlertCircle, roles: ["citizen", "admin", "authority", "emergency"] },
  { label: "Map", href: "/map", icon: Map, roles: ["citizen", "admin", "authority", "emergency"] },
  { label: "Transparency", href: "/transparency", icon: Building2, roles: ["citizen", "admin", "authority"] },
  { label: "Budget", href: "/budget", icon: DollarSign, roles: ["citizen", "admin", "authority"] },
  { label: "Admin Panel", href: "/admin", icon: Shield, roles: ["admin", "authority"] },
  { label: "Settings", href: "/settings", icon: Settings, roles: ["citizen", "admin", "authority", "emergency"] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, clearAuth } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: notifications } = useListNotifications({ query: { enabled: !!user } });
  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

  const filteredNav = navItems.filter((item) => !user?.role || item.roles.includes(user.role));

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-sidebar border-r border-sidebar-border w-64 shrink-0">
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white font-[family-name:var(--font-serif)]">RoadSoS AI</div>
            <div className="text-xs text-sidebar-foreground/50">Smart Safety Platform</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {filteredNav.map((item) => {
          const active = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
              <div
                data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-all duration-150 group ${
                  active
                    ? "bg-primary/20 text-primary border border-primary/20"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
                }`}
              >
                <item.icon className={`w-4 h-4 shrink-0 ${active ? "text-primary" : "text-sidebar-foreground/60 group-hover:text-white"}`} />
                <span className="flex-1">{item.label}</span>
                {item.href === "/emergency" && (
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                )}
                {item.href === "/settings" && unreadCount > 0 && (
                  <Badge className="text-xs h-5 min-w-5 px-1 bg-primary text-white">{unreadCount}</Badge>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        {user && (
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              {user.name[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{user.name}</div>
              <div className="text-xs text-sidebar-foreground/50 capitalize">{user.role}</div>
            </div>
          </div>
        )}
        <button
          data-testid="button-logout"
          onClick={clearAuth}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm text-sidebar-foreground/60 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="relative flex">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card">
          <button onClick={() => setMobileOpen(true)} className="text-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm">RoadSoS AI</span>
          </div>
          <Link href="/settings">
            <div className="relative">
              <Bell className="w-5 h-5 text-muted-foreground" />
              {unreadCount > 0 && <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />}
            </div>
          </Link>
        </div>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
