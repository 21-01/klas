import { useState, useEffect } from "react";
import { Link } from "react-router";
import { MapPin, Users, Clock, Loader2, ArrowRight, Search } from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/lib/api";

export function meta() {
  return [{ title: "Select Course - Admin Attendance - Klas." }];
}

export default function AdminAttendanceIndex() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    api
      .getAdminAttendanceCourses()
      .then((data) => setCourses(data.courses))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = courses.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      (c.mata_kuliah?.nama_mk || "").toLowerCase().includes(q) ||
      (c.mata_kuliah?.kode_mk || "").toLowerCase().includes(q) ||
      (c.dosen?.nama || "").toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-brand-secondary" size={32} />
      </div>
    );
  }

  if (error) {
    return <div className="text-status-error p-4">{error}</div>;
  }

  return (
    <div className="flex flex-col gap-[40px] w-full">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 w-full pb-2 border-b border-brand-border/40">
        <div className="flex flex-col items-start gap-[4px]">
          <span className="font-semibold text-brand-text-dim text-[11px] tracking-[1.2px] uppercase">
            ATTENDANCE MANAGEMENT
          </span>
          <h1 className="font-bold text-brand-primary text-[32px] tracking-[-0.64px] leading-tight">
            Select a Course
          </h1>
          <p className="text-brand-text-dim text-[14px] mt-1">
            Manage live attendance for any course in your program.
          </p>
        </div>
        <div className="relative w-full sm:w-[300px]">
          <Search className="absolute left-[12px] top-1/2 -translate-y-1/2 text-brand-text-dim" size={16} />
          <input
            type="text"
            placeholder="Search course, code, or lecturer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-brand-border text-brand-text placeholder-brand-text-dim/60 rounded-[10px] pl-[36px] pr-[12px] py-[10px] text-[13px] font-semibold focus:outline-none focus:border-brand-secondary"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[24px] w-full">
        {filtered.map((course) => {
          const isLive = course.latest_session?.status === "live";
          return (
            <Link
              key={course.jadwal_id}
              to={`/admin/attendance/${course.jadwal_id}`}
              className={cn(
                "bg-white border-2 rounded-[16px] p-[24px] flex flex-col gap-[20px] relative transition-all shadow-sm overflow-hidden group",
                isLive
                  ? "border-brand-secondary shadow-md hover:shadow-lg"
                  : "border-brand-border hover:border-brand-secondary/40 hover:shadow-md"
              )}
            >
              {isLive && (
                <div className="absolute top-[16px] right-[16px] flex items-center gap-[6px]">
                  <div className="size-[8px] bg-emerald-500 rounded-full animate-ping" />
                  <span className="text-[10px] font-bold text-emerald-600 uppercase">Live</span>
                </div>
              )}

              <div className="flex flex-col gap-[4px]">
                <h2 className="font-bold text-brand-primary text-[20px] leading-tight">
                  {course.mata_kuliah.kode_mk} - {course.mata_kuliah.nama_mk}
                </h2>
                <div className="flex items-center gap-[6px] text-brand-text-dim text-[13px] font-semibold">
                  <Users size={16} />
                  <span>{course.enrolled} Students Enrolled</span>
                </div>
                <div className="flex items-center gap-[6px] text-brand-text-dim text-[13px] font-semibold">
                  <span className="text-[12px]">Lecturer: {course.dosen?.nama}</span>
                </div>
              </div>

              <hr className="border-brand-border/40" />

              <div className="flex gap-[16px] items-center text-brand-text-dim text-[13px] font-semibold">
                <div className="flex items-center gap-[6px]">
                  <Clock size={16} />
                  <span>
                    {course.hari ? course.hari.substring(0, 3) + ", " : ""}
                    {course.waktu_mulai?.substring(0, 5)}-
                    {course.waktu_selesai?.substring(0, 5)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-auto pt-2">
                <span
                  className={cn(
                    "font-bold text-[14px]",
                    isLive ? "text-brand-secondary" : "text-brand-text-dim"
                  )}
                >
                  {isLive ? "Open Live Attendance" : "Manage Attendance"}
                </span>
                <ArrowRight
                  size={18}
                  className="text-brand-text-dim group-hover:text-brand-secondary group-hover:translate-x-1 transition-all"
                />
              </div>
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-brand-text-dim">
            No courses found.
          </div>
        )}
      </div>
    </div>
  );
}
