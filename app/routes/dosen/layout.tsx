import { useState, useEffect } from "react";
import { Outlet, NavLink, Link, useNavigate, redirect } from "react-router";
import ClickAwayListener from "~/components/ClickAwayListener";
import { Bell, Settings, LogOut, AlertCircle, CheckCircle, BellDot } from "lucide-react";
import { cn } from "~/lib/utils";
import { api, clearProfileCache } from "~/lib/api";
import { supabase } from "~/lib/supabase";

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
    if (profile.role !== "dosen") {
      return redirect("/login");
    }
    return null;
  } catch {
    return redirect("/login");
  }
}

export default function DosenLayout() {
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [user, setUser] = useState({ name: "", email: "", initials: "" });
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [notifCount, setNotifCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(true);

  useEffect(() => {
    api.getMyProfile().then((profile) => {
      const name = "nama" in profile ? profile.nama : "name" in profile ? profile.name : "";
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
    <div className="min-h-screen bg-brand-bg flex flex-col font-sans w-full text-brand-text">
      {/* Desktop Portal Header Navigation */}
      <header className="bg-white border-b border-brand-border sticky top-0 z-50 w-full">
        <div className="max-w-[1280px] mx-auto px-[24px] h-[72px] flex items-center justify-between">

          {/* Logo Brand */}
          <div className="flex items-center gap-[12px]">
            <img src="/logo.svg" alt="KLAS Logo" className="h-[36px] w-auto" />
            <span className="font-extrabold text-[24px] tracking-tight text-brand-primary">KLAS</span>
            <span className="bg-brand-secondary/10 text-brand-secondary font-bold text-[10px] tracking-[0.5px] uppercase px-[8px] py-[2px] rounded">
              LECTURER
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="flex gap-[32px] items-center h-full">
            <NavItem to="/dosen" exact label="Dashboard" />
            <NavItem to="/dosen/attendance" label="Attendance" />
            <NavItem to="/dosen/report" label="Report" />
          </nav>

          {/* Right Side Tools & Profile */}
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
                  <div className="absolute top-[6px] right-[6px] min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full px-[4px]">
                    {notifCount > 99 ? "99+" : notifCount}
                  </div>
                )}
              </button>

              {showNotifications && (
                <ClickAwayListener onClickAway={() => setShowNotifications(false)} className="absolute right-0 mt-3 w-[400px] bg-white border border-brand-border rounded-[12px] shadow-lg p-[24px] z-50 text-left flex flex-col gap-[16px] animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between border-b border-brand-border/40 pb-[12px]">
                    <span className="font-bold text-brand-primary text-[17px]">Notifications</span>
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

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowProfile(!showProfile);
                  setShowNotifications(false);
                }}
                className="flex items-center gap-[12px] border-l border-brand-border pl-5 hover:opacity-80 transition-opacity cursor-pointer text-left"
              >
                <div className="size-[36px] bg-brand-secondary text-white font-bold text-[14px] flex items-center justify-center rounded-[10px] shadow-sm shrink-0">
                  {user.initials || "—"}
                </div>
                <div className="hidden md:flex flex-col">
                  <span className="font-semibold text-[13px] leading-tight text-brand-text">{user.name || "Lecturer"}</span>
                  <span className="text-brand-text-dim text-[11px]">{user.email}</span>
                </div>
              </button>

              {showProfile && (
                <ClickAwayListener onClickAway={() => setShowProfile(false)} className="absolute right-0 mt-3 w-[320px] bg-white border border-brand-border rounded-[12px] shadow-lg p-[24px] z-50 text-left flex flex-col gap-[16px] animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center gap-[14px] border-b border-brand-border/40 pb-[14px]">
                    <div className="size-[48px] bg-brand-secondary text-white font-extrabold text-[20px] flex items-center justify-center rounded-[10px] shadow-sm shrink-0">
                      {user.initials || "—"}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-brand-primary text-[16px] leading-tight truncate">{user.name || "Lecturer"}</span>
                      <span className="text-brand-text-dim text-[13px] truncate">{user.email}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-[8px]">
                    <button
                      onClick={() => { setShowProfile(false); navigate("/dosen/account-settings"); }}
                      className="w-full text-left font-bold text-[13px] uppercase tracking-[0.5px] px-[14px] py-[12px] rounded-[8px] hover:bg-slate-100 text-brand-text-dim hover:text-brand-text flex items-center gap-[10px] transition-colors cursor-pointer"
                    >
                      <Settings size={18} />
                      <span>Account Settings</span>
                    </button>
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

      {/* Main Viewport Content Area */}
      <main className="flex-1 w-full max-w-[1280px] mx-auto px-[24px] py-[32px] flex flex-col justify-start">
        <Outlet />
      </main>
    </div>
  );
}

interface NavItemProps {
  to: string;
  label: string;
  exact?: boolean;
}

function NavItem({ to, label, exact }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        cn(
          "font-bold text-[13px] tracking-[0.8px] uppercase h-[72px] flex items-center px-[8px] border-b-2 transition-all duration-200 cursor-pointer",
          isActive
            ? "border-brand-primary text-brand-primary"
            : "border-transparent text-brand-text-dim hover:text-brand-text hover:border-brand-border"
        )
      }
    >
      {label}
    </NavLink>
  );
}

export function ErrorBoundary() {
  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center text-brand-text">
      <p className="font-semibold">Something went wrong.</p>
    </div>
  );
}
