import { useState, useEffect } from "react";
import { Link } from "react-router";
import {
  Users, MapPin, Percent, AlertTriangle, Search, FileDown,
  ExternalLink, ShieldAlert, GraduationCap, Loader2
} from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/lib/api";

export function meta() {
  return [
    { title: "Academic Analytics - Admin Console - Klas." },
  ];
}

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    api.getAdminDashboard()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-brand-secondary" size={32} /></div>;
  }

  if (!data) {
    return <div className="text-status-error p-4">Failed to load dashboard data.</div>;
  }

  const trends = data.attendance_trend || [];

  const filteredCourses = [
    { code: "Overview", title: "Total Students", coordinator: `${data.total_students}`, enrolled: data.total_enrollments, rate: data.overall_attendance_rate, alerts: data.geofence_violations },
  ].filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-[32px] w-full">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 w-full pb-2 border-b border-brand-border/40">
        <div className="flex flex-col items-start gap-[4px]">
          <span className="font-semibold text-brand-text-dim text-[11px] tracking-[1.2px] uppercase">
            SYSTEM INSIGHTS
          </span>
          <h1 className="font-bold text-brand-primary text-[32px] tracking-[-0.64px] leading-tight">
            Academic Analytics &amp; Reports
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[20px] w-full">
        <div className="bg-white border border-brand-border rounded-[16px] p-[20px] flex flex-col gap-[6px] shadow-sm">
          <span className="text-brand-text-dim text-[11px] font-bold tracking-[0.5px] uppercase">Active Sessions Today</span>
          <div className="flex items-baseline justify-between w-full">
            <span className="font-extrabold text-brand-primary text-[28px]">{data.active_sessions_today} Sessions</span>
            <span className="text-brand-secondary bg-brand-secondary/10 text-[10px] font-extrabold px-[6px] py-[2px] rounded uppercase">Live</span>
          </div>
        </div>
        <div className="bg-white border border-brand-border rounded-[16px] p-[20px] flex flex-col gap-[6px] shadow-sm">
          <span className="text-brand-text-dim text-[11px] font-bold tracking-[0.5px] uppercase">Avg Attendance Rate</span>
          <div className="flex items-baseline justify-between w-full">
            <span className="font-extrabold text-brand-primary text-[28px]">{data.overall_attendance_rate}%</span>
            <span className="text-emerald-600 text-[11px] font-semibold">Target: &gt;90%</span>
          </div>
        </div>
        <div className="bg-white border border-brand-border rounded-[16px] p-[20px] flex flex-col gap-[6px] shadow-sm">
          <span className="text-brand-text-dim text-[11px] font-bold tracking-[0.5px] uppercase">Geofence Violation Alerts</span>
          <div className="flex items-baseline justify-between w-full">
            <span className="font-extrabold text-red-600 text-[28px]">{data.geofence_violations} flags</span>
            {data.geofence_violations > 0 && (
              <span className="bg-red-50 text-red-800 text-[10px] font-bold px-[6px] py-[2px] rounded uppercase">Active</span>
            )}
          </div>
        </div>
        <div className="bg-white border border-brand-border rounded-[16px] p-[20px] flex flex-col gap-[6px] shadow-sm">
          <span className="text-brand-text-dim text-[11px] font-bold tracking-[0.5px] uppercase">Total Students</span>
          <div className="flex items-baseline justify-between w-full">
            <span className="font-extrabold text-emerald-600 text-[28px]">{data.total_students}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-[24px] w-full items-start">
        <div className="lg:col-span-8 bg-white border border-brand-border rounded-[16px] p-[24px] flex flex-col gap-[20px] shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-brand-primary text-[18px]">Attendance Trends</h3>
              <span className="text-[12px] text-brand-text-dim">Daily attendance across all sessions</span>
            </div>
          </div>

          <div className="relative border-b border-brand-border/60 pb-[24px] pt-[48px] px-[32px] h-[280px] flex items-end justify-between gap-[24px]">
            <div className="absolute inset-x-0 bottom-[24px] top-[48px] flex flex-col justify-between pointer-events-none opacity-20">
              {[0,1,2,3].map((i) => <div key={i} className="w-full border-t border-brand-border" />)}
            </div>
            {trends.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-brand-text-dim text-[13px]">
                No trend data available
              </div>
            )}
            {trends.map((item: any) => {
              const maxVal = Math.max(...trends.map((t: any) => t.present_count + t.absent_count), 1);
              const totalHeight = ((item.present_count + item.absent_count) / maxVal) * 200;
              return (
                <div key={item.date} className="flex-1 flex flex-col items-center gap-[12px] group relative h-full justify-end">
                  <span className="text-[12px] font-extrabold text-brand-primary">
                    {totalHeight > 0 ? Math.round((item.present_count / (item.present_count + item.absent_count)) * 100) : 0}%
                  </span>
                  <div className="w-full flex flex-col items-center gap-[2px]" style={{ height: `${Math.max(totalHeight, 4)}px` }}>
                    <div className="w-full flex-1 bg-brand-secondary/40 border border-brand-secondary rounded-t-[4px]"
                      style={{ height: `${(item.present_count / maxVal) * 200}px` }} />
                    <div className="w-full bg-red-400/40 border border-red-400 rounded-b-[4px]"
                      style={{ height: `${(item.absent_count / maxVal) * 200}px` }} />
                  </div>
                  <span className="text-[12px] font-bold text-brand-text-dim">
                    {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-4 bg-white border border-brand-border rounded-[16px] p-[24px] flex flex-col gap-[20px] shadow-sm">
          <div className="flex items-center gap-[8px]">
            <ShieldAlert className="text-red-500 shrink-0" size={20} />
            <h3 className="font-bold text-brand-primary text-[15px] tracking-[0.5px] uppercase">Summary</h3>
          </div>
          <div className="flex flex-col gap-[12px]">
            <div className="border border-brand-border/40 p-[12px] rounded-[10px] flex flex-col gap-[4px] bg-slate-50/50">
              <span className="font-extrabold text-brand-primary text-[13px]">Lecturers: {data.total_lecturers}</span>
              <span className="text-brand-text-dim text-[11px]">Courses: {data.total_courses}</span>
            </div>
            <div className="border border-brand-border/40 p-[12px] rounded-[10px] flex flex-col gap-[4px] bg-slate-50/50">
              <span className="font-extrabold text-brand-primary text-[13px]">Rooms: {data.total_rooms}</span>
              <span className="text-brand-text-dim text-[11px]">Low attendance students: {data.students_with_low_attendance}</span>
            </div>
            <div className="border border-brand-border/40 p-[12px] rounded-[10px] flex flex-col gap-[4px] bg-slate-50/50">
              <span className="font-extrabold text-brand-primary text-[13px]">Completed Today: {data.completed_sessions_today}</span>
              <span className="text-brand-text-dim text-[11px]">All time: {data.total_sessions_all_time}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-brand-border rounded-[16px] shadow-sm overflow-hidden flex flex-col w-full">
        <div className="p-[20px] border-b border-brand-border bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="font-bold text-brand-primary text-[18px]">System Overview</h3>
          <div className="relative w-full sm:w-[280px]">
            <Search className="absolute left-[12px] top-1/2 -translate-y-1/2 text-brand-text-dim" size={16} />
            <input type="text" placeholder="Search..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-brand-border text-brand-text placeholder-brand-text-dim/60 rounded-[8px] pl-[36px] pr-[12px] py-[8px] text-[13px] focus:outline-none focus:border-brand-secondary" />
          </div>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-brand-border text-brand-text-dim text-[11px] font-bold uppercase tracking-[1px]">
                <th className="px-[24px] py-[16px]">Metric</th>
                <th className="px-[24px] py-[16px]">Value</th>
                <th className="px-[24px] py-[16px]">Detail</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Total Students", value: data.total_students, detail: `${data.students_with_low_attendance} with low attendance` },
                { label: "Total Lecturers", value: data.total_lecturers, detail: "Active faculty" },
                { label: "Total Courses", value: data.total_courses, detail: "Active courses" },
                { label: "Total Rooms", value: data.total_rooms, detail: "Available rooms" },
                { label: "Sessions Today", value: `${data.active_sessions_today} active / ${data.completed_sessions_today} completed`, detail: `${data.total_sessions_all_time} all time` },
                { label: "Attendance Rate", value: `${data.overall_attendance_rate}%`, detail: "Overall average" },
                { label: "Geofence Violations", value: data.geofence_violations, detail: "Flagged check-ins" },
              ].map((row, idx) => (
                <tr key={row.label} className={cn("border-b border-brand-border/40 hover:bg-slate-50/50", idx % 2 === 1 ? "bg-slate-50/20" : "bg-white")}>
                  <td className="px-[24px] py-[16px] font-bold text-[14px] text-brand-primary">{row.label}</td>
                  <td className="px-[24px] py-[16px] font-extrabold text-brand-text">{row.value}</td>
                  <td className="px-[24px] py-[16px] text-brand-text-dim text-[13px]">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
