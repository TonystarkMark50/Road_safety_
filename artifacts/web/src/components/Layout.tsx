import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard, FileText, Plus, AlertCircle, Map, Building2,
  DollarSign, Bell, Settings, LogOut, Shield, X, User,
  Home, ChevronRight
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useListNotifications } from "@workspace/api-client-react";

/* ─── Nav Items ───────────────────────────────────────────────────── */

const drawerItems = [
  { label: "Home",         href: "/dashboard",    icon: Home,           roles: ["citizen", "admin", "authority", "emergency"] },
  { label: "Reports",      href: "/reports",       icon: FileText,       roles: ["citizen", "admin", "authority", "emergency"] },
  { label: "Live Map",     href: "/map",           icon: Map,            roles: ["citizen", "admin", "authority", "emergency"] },
  { label: "Emergency",    href: "/emergency",     icon: AlertCircle,    roles: ["citizen", "admin", "authority", "emergency"] },
  { label: "Transparency", href: "/transparency",  icon: Building2,      roles: ["citizen", "admin", "authority"] },
  { label: "Profile",      href: "/settings",      icon: User,           roles: ["citizen", "admin", "authority", "emergency"] },
  { label: "Settings",     href: "/settings",      icon: Settings,       roles: ["citizen", "admin", "authority", "emergency"] },
];

const sidebarItems = [
  { label: "Dashboard",    href: "/dashboard",    icon: LayoutDashboard, roles: ["citizen", "admin", "authority", "emergency"] },
  { label: "Reports",      href: "/reports",       icon: FileText,        roles: ["citizen", "admin", "authority", "emergency"] },
  { label: "File Report",  href: "/reports/new",   icon: Plus,            roles: ["citizen", "admin"] },
  { label: "My Reports",   href: "/my-reports",    icon: FileText,        roles: ["citizen"] },
  { label: "Emergency",    href: "/emergency",     icon: AlertCircle,     roles: ["citizen", "admin", "authority", "emergency"] },
  { label: "Map",          href: "/map",           icon: Map,             roles: ["citizen", "admin", "authority", "emergency"] },
  { label: "Transparency", href: "/transparency",  icon: Building2,       roles: ["citizen", "admin", "authority"] },
  { label: "Budget",       href: "/budget",        icon: DollarSign,      roles: ["citizen", "admin", "authority"] },
  { label: "Settings",     href: "/settings",      icon: Settings,        roles: ["citizen", "admin", "authority", "emergency"] },
];

/* ─── Hamburger Icon ──────────────────────────────────────────────── */

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <div className="w-5 h-4 flex flex-col justify-between cursor-pointer">
      <span
        className="block h-0.5 bg-current rounded-full transition-all duration-300 origin-center"
        style={{ transform: open ? "translateY(7px) rotate(45deg)" : "none" }}
      />
      <span
        className="block h-0.5 bg-current rounded-full transition-all duration-300"
        style={{ opacity: open ? 0 : 1, transform: open ? "scaleX(0)" : "scaleX(1)" }}
      />
      <span
        className="block h-0.5 bg-current rounded-full transition-all duration-300 origin-center"
        style={{ transform: open ? "translateY(-7px) rotate(-45deg)" : "none" }}
      />
    </div>
  );
}

/* ─── Sliding Drawer ──────────────────────────────────────────────── */

function DrawerMenu({
  open, onClose, user, clearAuth, location, unreadCount,
}: {
  open: boolean;
  onClose: () => void;
  user: { name: string; email?: string; role: string } | null;
  clearAuth: () => void;
  location: string;
  unreadCount: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 380);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.35s cubic-bezier(0.4,0,0.2,1)",
        }}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        style={{
          position: "relative",
          width: 288,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "rgba(8,16,45,0.93)",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "8px 0 40px rgba(0,0,0,0.6), inset 1px 0 0 rgba(255,255,255,0.04)",
          transform: visible ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
          overflow: "hidden",
        }}
      >
        {/* Gradient accent top */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: "linear-gradient(90deg, #3b82f6, #06b6d4, #a855f7)",
        }} />

        {/* Header */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 12px rgba(59,130,246,0.4)",
              }}>
                <Shield style={{ width: 18, height: 18, color: "#fff" }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9", letterSpacing: "-0.01em" }}>RoadSoS AI</div>
                <div style={{ fontSize: 10, color: "rgba(148,163,184,0.7)", marginTop: 1 }}>Smart Safety Platform</div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center",
                justifyContent: "center", cursor: "pointer", color: "#94a3b8",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLButtonElement).style.color = "#e2e8f0"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8"; }}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>

          {/* User profile card */}
          {user && (
            <div style={{
              display: "flex", alignItems: "center", gap: 11,
              padding: "10px 12px", borderRadius: 12,
              background: "rgba(59,130,246,0.08)",
              border: "1px solid rgba(59,130,246,0.15)",
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: "50%",
                background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 15, color: "#fff",
                boxShadow: "0 2px 8px rgba(59,130,246,0.35)",
              }}>
                {user.name[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#f1f5f9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user.name}
                </div>
                <div style={{
                  fontSize: 10, marginTop: 2, display: "inline-flex", alignItems: "center",
                  background: "rgba(59,130,246,0.2)", color: "#60a5fa",
                  borderRadius: 4, padding: "1px 6px", fontWeight: 500, textTransform: "capitalize",
                }}>
                  {user.role}
                </div>
              </div>
              {unreadCount > 0 && (
                <div style={{
                  minWidth: 20, height: 20, borderRadius: 10, background: "#3b82f6",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, color: "#fff", padding: "0 5px",
                }}>
                  {unreadCount}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: "10px 12px", overflowY: "auto" }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(148,163,184,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "6px 8px 8px" }}>
            Navigation
          </div>
          {drawerItems.map((item, i) => {
            const active = location === item.href || (item.href !== "/" && location.startsWith(item.href) && item.href !== "/settings");
            const isMap = item.label === "Live Map";
            const isEmergency = item.label === "Emergency";
            return (
              <Link key={`${item.href}-${item.label}`} href={item.href} onClick={onClose}>
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "11px 12px", borderRadius: 10, marginBottom: 2,
                    cursor: "pointer", position: "relative", overflow: "hidden",
                    background: active ? "rgba(59,130,246,0.15)" : "transparent",
                    border: active ? "1px solid rgba(59,130,246,0.25)" : "1px solid transparent",
                    transform: visible ? "translateX(0)" : "translateX(-20px)",
                    opacity: visible ? 1 : 0,
                    transition: `transform 0.35s cubic-bezier(0.4,0,0.2,1) ${80 + i * 45}ms, opacity 0.3s ease ${60 + i * 45}ms, background 0.15s, border-color 0.15s`,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.06)";
                      (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLDivElement).style.background = "transparent";
                      (e.currentTarget as HTMLDivElement).style.borderColor = "transparent";
                    }
                  }}
                >
                  {/* Active left accent bar */}
                  {active && (
                    <div style={{
                      position: "absolute", left: 0, top: "20%", bottom: "20%",
                      width: 3, borderRadius: "0 2px 2px 0",
                      background: "linear-gradient(180deg, #3b82f6, #06b6d4)",
                    }} />
                  )}
                  <div style={{
                    width: 34, height: 34, borderRadius: 9, display: "flex",
                    alignItems: "center", justifyContent: "center", flexShrink: 0,
                    background: active
                      ? "rgba(59,130,246,0.25)"
                      : isEmergency ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.05)",
                    border: active ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(255,255,255,0.06)",
                  }}>
                    <item.icon style={{
                      width: 16, height: 16,
                      color: active ? "#60a5fa" : isEmergency ? "#f87171" : isMap ? "#06b6d4" : "#94a3b8",
                    }} />
                  </div>
                  <span style={{
                    flex: 1, fontSize: 13, fontWeight: active ? 600 : 500,
                    color: active ? "#e2e8f0" : "#94a3b8",
                  }}>
                    {item.label}
                  </span>
                  {isEmergency && (
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 6px #ef4444" }} className="animate-pulse" />
                  )}
                  {isMap && !isEmergency && (
                    <span style={{
                      fontSize: 9, fontWeight: 600, color: "#06b6d4", background: "rgba(6,182,212,0.12)",
                      border: "1px solid rgba(6,182,212,0.2)", borderRadius: 4, padding: "1px 6px",
                    }}>LIVE</span>
                  )}
                  {!isEmergency && !isMap && (
                    <ChevronRight style={{ width: 13, height: 13, color: "rgba(148,163,184,0.3)" }} />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer — Logout */}
        <div style={{
          padding: "12px 12px 20px",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          transform: visible ? "translateY(0)" : "translateY(20px)",
          opacity: visible ? 1 : 0,
          transition: "transform 0.4s cubic-bezier(0.4,0,0.2,1) 400ms, opacity 0.35s ease 400ms",
        }}>
          <button
            onClick={() => { clearAuth(); onClose(); }}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "11px 12px", borderRadius: 10, width: "100%",
              background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.1)",
              cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.12)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.22)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.06)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.1)";
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 9, display: "flex",
              alignItems: "center", justifyContent: "center",
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.15)",
            }}>
              <LogOut style={{ width: 15, height: 15, color: "#f87171" }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#f87171", flex: 1, textAlign: "left" }}>
              Sign Out
            </span>
          </button>
        </div>

        {/* Bottom gradient glow */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 120,
          background: "linear-gradient(0deg, rgba(59,130,246,0.06) 0%, transparent 100%)",
          pointerEvents: "none",
        }} />
      </div>
    </div>
  );
}

/* ─── Desktop Sidebar ─────────────────────────────────────────────── */

function DesktopSidebar({
  user, clearAuth, location, unreadCount,
}: {
  user: { name: string; email?: string; role: string } | null;
  clearAuth: () => void;
  location: string;
  unreadCount: number;
}) {
  const filtered = sidebarItems.filter((item) => !user?.role || item.roles.includes(user.role));

  return (
    <aside style={{
      display: "flex", flexDirection: "column", height: "100%",
      width: 240, flexShrink: 0,
      background: "rgba(8,16,45,0.97)",
      borderRight: "1px solid rgba(255,255,255,0.07)",
    }}>
      {/* Accent */}
      <div style={{ height: 3, background: "linear-gradient(90deg, #3b82f6, #06b6d4, #a855f7)" }} />

      <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(59,130,246,0.35)",
          }}>
            <Shield style={{ width: 17, height: 17, color: "#fff" }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9" }}>RoadSoS AI</div>
            <div style={{ fontSize: 10, color: "rgba(148,163,184,0.6)" }}>Smart Safety Platform</div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "8px 10px", overflowY: "auto" }}>
        {filtered.map((item) => {
          const active = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={`${item.href}-${item.label}`} href={item.href}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 10px", borderRadius: 8, marginBottom: 2, cursor: "pointer",
                background: active ? "rgba(59,130,246,0.15)" : "transparent",
                border: active ? "1px solid rgba(59,130,246,0.2)" : "1px solid transparent",
                position: "relative", overflow: "hidden",
              }}>
                {active && (
                  <div style={{
                    position: "absolute", left: 0, top: "15%", bottom: "15%",
                    width: 3, borderRadius: "0 2px 2px 0",
                    background: "linear-gradient(180deg, #3b82f6, #06b6d4)",
                  }} />
                )}
                <item.icon style={{
                  width: 15, height: 15, flexShrink: 0,
                  color: active ? "#60a5fa" : item.href === "/emergency" ? "#f87171" : "#64748b",
                }} />
                <span style={{
                  flex: 1, fontSize: 13, fontWeight: active ? 600 : 400,
                  color: active ? "#e2e8f0" : "#94a3b8",
                }}>
                  {item.label}
                </span>
                {item.href === "/emergency" && (
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444" }} className="animate-pulse" />
                )}
                {item.href === "/settings" && unreadCount > 0 && (
                  <span style={{
                    minWidth: 18, height: 18, borderRadius: 9, background: "#3b82f6",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700, color: "#fff", padding: "0 4px",
                  }}>{unreadCount}</span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: "10px 10px 14px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", marginBottom: 4 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 13, color: "#fff",
            }}>
              {user.name[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
              <div style={{ fontSize: 10, color: "#64748b", textTransform: "capitalize" }}>{user.role}</div>
            </div>
          </div>
        )}
        <button
          data-testid="button-logout"
          onClick={clearAuth}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 10px", width: "100%", borderRadius: 8,
            background: "transparent", border: "1px solid transparent",
            cursor: "pointer", transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.08)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.15)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent";
          }}
        >
          <LogOut style={{ width: 14, height: 14, color: "#f87171" }} />
          <span style={{ fontSize: 12, color: "#f87171", fontWeight: 500 }}>Sign out</span>
        </button>
      </div>
    </aside>
  );
}

/* ─── Layout ──────────────────────────────────────────────────────── */

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, clearAuth } = useAuth();
  const [location] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: notifications } = useListNotifications({ query: { enabled: !!user } });
  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

  // Lock scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  const sharedProps = { user, clearAuth, location, unreadCount };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:flex">
        <DesktopSidebar {...sharedProps} />
      </div>

      {/* Sliding drawer — all screen sizes (primary on mobile) */}
      <DrawerMenu
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        {...sharedProps}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div
          className="md:hidden flex items-center justify-between px-4 border-b"
          style={{
            height: 54,
            background: "rgba(8,16,45,0.97)",
            borderBottomColor: "rgba(255,255,255,0.07)",
          }}
        >
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Shield style={{ width: 14, height: 14, color: "#fff" }} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9" }}>RoadSoS AI</span>
          </div>

          {/* Right side: notification dot + hamburger */}
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <Link href="/settings">
                <div style={{ position: "relative", cursor: "pointer" }}>
                  <Bell style={{ width: 18, height: 18, color: "#64748b" }} />
                  <div style={{
                    position: "absolute", top: -2, right: -2,
                    width: 8, height: 8, borderRadius: "50%",
                    background: "#3b82f6", border: "1.5px solid #080f2c",
                  }} />
                </div>
              </Link>
            )}
            {/* Hamburger ☰ */}
            <button
              onClick={() => setDrawerOpen(true)}
              style={{
                width: 36, height: 36, borderRadius: 9, cursor: "pointer",
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#e2e8f0",
              }}
              aria-label="Open menu"
            >
              <HamburgerIcon open={false} />
            </button>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
