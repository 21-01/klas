import { Outlet, NavLink, redirect } from "react-router";
import { Home, FileSpreadsheet, User } from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/lib/api";

export async function clientLoader() {
  try {
    const profile = await api.getMyProfile();
    if (profile.role !== "mahasiswa") {
      return redirect("/login");
    }
    return null;
  } catch {
    return redirect("/login");
  }
}

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col sm:items-center sm:justify-center">
      <div className="w-full sm:w-[500px] h-screen bg-black flex flex-col">
        <div className="flex-1 overflow-y-auto bg-brand-bg">
          <Outlet />
        </div>
        <nav className="h-[73px] bg-brand-bg border-t border-brand-border flex gap-[32px] items-center justify-center pb-[12px] pt-[13px] px-[64px] z-10 shrink-0">
          <NavItem to="/mahasiswa" icon={<Home size={22} />} label="Home" exact />
          <NavItem to="/mahasiswa/logs" icon={<FileSpreadsheet size={22} />} label="Logs" />
          <NavItem to="/mahasiswa/profile" icon={<User size={22} />} label="Profile" />
        </nav>
      </div>
    </div>
  );
}

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  exact?: boolean;
}

function NavItem({ to, icon, label, exact }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        cn(
          "flex flex-col gap-[4px] items-center justify-center px-[12px] py-[4px] rounded-[8px] transition-all duration-200 w-[60px]",
          isActive
            ? "bg-brand-primary text-white"
            : "text-brand-text-dim hover:bg-[#f3f4f6]"
        )
      }
    >
      <div className="size-[20px] flex items-center justify-center">{icon}</div>
      <span className="font-semibold text-[10px] tracking-[0.6px] leading-[12px]">
        {label}
      </span>
    </NavLink>
  );
}

export function ErrorBoundary() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center text-brand-text">
      <p className="font-semibold">Something went wrong.</p>
    </div>
  );
}
