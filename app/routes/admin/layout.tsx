import { useState, useEffect } from "react";
import { Outlet, NavLink, Link, redirect } from "react-router";
import ClickAwayListener from "~/components/ClickAwayListener";
import {
  BarChart3,
  Database,
  Activity,
  Calendar,
  FileSpreadsheet,
  Bell,
  UserCheck,
  LogOut,
  AlertCircle,
  CheckCircle,
  BellDot,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { api, clearProfileCache } from "~/lib/api";

type NotifItem = {
  notifikasi_id: string;
  tipe: string;
  judul: string;
  pesan: string | null;
  is_read: boolean;
  created_at: string;
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export async function clientLoader() {
  try {
    const profile = await api.getMyProfile();
    if (profile.role !== "admin") {
      return redirect("/login");
    }
    return null;
  } catch {
    return redirect("/login");
  }
}

export default function AdminLayout() {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [user, setUser] = useState({ name: "", email: "", initials: "" });
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [notifCount, setNotifCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(true);

  useEffect(() => {
    api.getMyProfile().then((profile) => {
      const name = "name" in profile ? profile.name : "nama" in profile ? profile.nama : "";
      setUser({
        name,
        email: profile.email || "",
        initials: getInitials(name),
      });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    api
      .getNotifications("list", { limit: 50 })
      .then((res: any) => {
        const items: NotifItem[] = res.notifications ?? [];
        setNotifications(items);
        setNotifCount(items.filter((n) => !n.is_read).length);
      })
      .catch(() => {
        setNotifications([]);
        setNotifCount(0);
      })
      .finally(() => setNotifLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans w-full text-brand-text">

      {/* Permanent Sidebar Navigation (Aside) */}
      <aside className="w-[260px] bg-brand-primary text-white flex flex-col fixed inset-y-0 left-0 z-40 border-r border-brand-primary/40 shadow-xl">
        {/* Brand Header */}
        <div className="h-[72px] px-[24px] flex items-center gap-[12px] border-b border-white/10 shrink-0">
          <img src="/logo.svg" alt="KLAS Logo" className="h-[36px] w-auto brightness-0 invert" />
          <div className="flex flex-col">
            <span className="font-extrabold text-[20px] tracking-tight leading-tight">KLAS</span>
            <span className="text-slate-400 font-semibold text-[10px] tracking-[0.5px] uppercase">
              University Portal
            </span>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 px-[16px] py-[24px] flex flex-col gap-[8px] overflow-y-auto">
          <span className="text-slate-400 font-bold text-[10px] tracking-[1.5px] uppercase px-[12px] mb-2">
            Core Panel
          </span>

          <SidebarLink to="/admin" exact icon={BarChart3} label="Dashboard" />
          <SidebarLink to="/admin/master-data" icon={Database} label="Master Data" />
          <SidebarLink to="/admin/attendance" icon={Activity} label="Global Attendance" />
          <SidebarLink to="/admin/schedule" icon={Calendar} label="Schedule Plotting" />

          <span className="text-slate-400 font-bold text-[10px] tracking-[1.5px] uppercase px-[12px] mt-[24px] mb-2">
            Administration
          </span>

          <SidebarLink to="/admin/audit-logs" icon={FileSpreadsheet} label="Audit Logs" />
        </nav>
      </aside>

      {/* Main Right Content Section */}
      <div className="flex-1 pl-[260px] flex flex-col min-h-screen">

        {/* Top Header Utilities */}
        <header className="bg-white border-b border-brand-border h-[72px] sticky top-0 z-30 w-full shrink-0">
          <div className="px-[40px] h-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="bg-brand-secondary/10 text-brand-secondary font-bold text-[10px] tracking-[1px] uppercase px-[8px] py-[3px] rounded">
                Admin Console
              </span>
            </div>

            <div className="flex items-center gap-[20px]">

              {/* Notifications Dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                    setShowProfile(false);
                  }}
                  className="text-brand-text-dim hover:text-brand-text p-2 hover:bg-slate-100 rounded-full transition-all cursor-pointer relative flex"
                >
                  {notifCount > 0 ? <BellDot size={20} /> : <Bell size={20} />}
                  {notifCount > 0 && (
                    <div className="absolute top-[6px] right-[6px] min-w-[16px] h-[16px] bg-brand-secondary text-white text-[9px] font-bold flex items-center justify-center rounded-full px-[4px]">
                      {notifCount > 99 ? "99+" : notifCount}
                    </div>
                  )}
                </button>

                {showNotifications && (
                  <ClickAwayListener onClickAway={() => setShowNotifications(false)} className="absolute right-0 mt-3 w-[400px] bg-white border border-brand-border rounded-[12px] shadow-lg p-[24px] z-50 text-left flex flex-col gap-[16px] animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between border-b border-brand-border/40 pb-[12px]">
                      <span className="font-bold text-brand-primary text-[17px]">System Notifications</span>
                      {notifications.length > 0 && (
                        <button
                          onClick={() => {
                            api.getNotifications("mark-all-read").catch(() => {});
                            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
                            setNotifCount(0);
                          }}
                          className="text-brand-secondary hover:underline text-[13px] font-bold"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                    {notifLoading ? (
                      <div className="text-center py-6 text-brand-text-dim text-[14px]">Loading...</div>
                    ) : notifications.length === 0 ? (
                      <div className="text-center py-6 text-brand-text-dim text-[14px]">No notifications</div>
                    ) : (
                      <div className="flex flex-col gap-[14px] max-h-[300px] overflow-y-auto pr-1">
                        {notifications.map((n) => (
                          <div key={n.notifikasi_id} className="flex gap-[12px] items-start text-[14px] border-b border-brand-border/20 pb-[12px] last:border-0 last:pb-0">
                            {n.tipe === "geofence_flag" ? (
                              <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                            ) : n.tipe === "new_account" ? (
                              <UserCheck className="text-blue-500 shrink-0 mt-0.5" size={18} />
                            ) : n.tipe === "session_closed" || n.tipe === "checkin_success" ? (
                              <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                            ) : (
                              <Bell className="text-brand-text-dim shrink-0 mt-0.5" size={18} />
                            )}
                            <div className="flex flex-col">
                              <span className="font-semibold text-brand-primary">{n.judul}</span>
                              {n.pesan && <span className="text-brand-text-dim">{n.pesan}</span>}
                              <span className="text-[12px] text-brand-text-dim/60 mt-1">
                                {new Date(n.created_at).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ClickAwayListener>
                )}
              </div>

              <div className="w-[1px] h-[32px] bg-brand-border" />

              {/* Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowProfile(!showProfile);
                    setShowNotifications(false);
                  }}
                  className="flex items-center gap-[12px] hover:opacity-80 transition-opacity cursor-pointer text-left focus:outline-none"
                >
                  <div className="flex flex-col text-right hidden md:flex">
                    <span className="font-semibold text-[13px] leading-tight text-brand-text">{user.name || "Admin"}</span>
                    <span className="text-brand-text-dim text-[11px]">Administrator</span>
                  </div>
                  <div className="size-[36px] bg-brand-secondary text-white font-bold text-[14px] flex items-center justify-center rounded-[10px] shadow-sm shrink-0">
                    {user.initials || "AD"}
                  </div>
                </button>

                {showProfile && (
                  <ClickAwayListener onClickAway={() => setShowProfile(false)} className="absolute right-0 mt-3 w-[320px] bg-white border border-brand-border rounded-[12px] shadow-lg p-[24px] z-50 text-left flex flex-col gap-[16px] animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center gap-[14px] border-b border-brand-border/40 pb-[14px]">
                      <div className="size-[48px] bg-brand-secondary text-white font-extrabold text-[20px] flex items-center justify-center rounded-[10px] shadow-sm shrink-0">
                        {user.initials || "AD"}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-brand-primary text-[16px] leading-tight truncate">{user.name || "Admin"}</span>
                        <span className="text-brand-text-dim text-[13px] truncate">{user.email}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-[8px]">
                      <button
                        onClick={() => { clearProfileCache(); localStorage.clear(); window.location.href = "/login"; }}
                        className="w-full text-left font-bold text-[13px] uppercase tracking-[0.5px] px-[14px] py-[12px] rounded-[8px] hover:bg-red-50 text-red-600 flex items-center gap-[10px] transition-colors cursor-pointer"
                      >
                        <LogOut size={18} />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </ClickAwayListener>
                )}
              </div>

            </div>
          </div>
        </header>

        {/* Content Outlet Canvas */}
        <main className="flex-1 p-[40px] bg-brand-canvas">
          <Outlet />
        </main>
      </div>

    </div>
  );
}

interface SidebarLinkProps {
  to: string;
  exact?: boolean;
  icon: React.ComponentType<{ size: number; className?: string }>;
  label: string;
}

function SidebarLink({ to, exact, icon: Icon, label }: SidebarLinkProps) {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-[12px] px-[16px] py-[12px] rounded-[8px] text-[13px] font-bold tracking-[0.5px] uppercase transition-all duration-150 cursor-pointer border-l-4",
          isActive
            ? "bg-white/10 text-white border-white"
            : "text-slate-300 border-transparent hover:bg-white/5 hover:text-white"
        )
      }
    >
      <Icon size={18} className="shrink-0" />
      <span>{label}</span>
    </NavLink>
  );
}

export function ErrorBoundary() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center text-brand-text">
      <p className="font-semibold">Something went wrong.</p>
    </div>
  );
}
