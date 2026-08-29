import { useState, useEffect } from "react";
import { Link } from "react-router";
import { MapPin, Users, Clock, Loader2, ArrowRight } from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/lib/api";

export function meta() {
  return [{ title: "Select Course - Klas." }];
}

export default function AttendanceIndex() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getDosenDashboard()
      .then((data) => setCourses(data.courses))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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
      <div className="flex flex-col items-start gap-[4px] pb-2 border-b border-brand-border/40">
        <span className="font-semibold text-brand-text-dim text-[12px] tracking-[1.2px] uppercase">
          ATTENDANCE
        </span>
        <h1 className="font-bold text-brand-primary text-[32px] tracking-[-0.64px] leading-tight">
          Select a Course
        </h1>
        <p className="text-brand-text-dim text-[14px] mt-1">
          Choose a course to manage live attendance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[24px] w-full">
        {courses.map((course) => {
          const isLive = course.latest_session?.status === "live";
          return (
            <Link
              key={course.jadwal_id}
              to={`/dosen/attendance/${course.jadwal_id}`}
              className={cn(
                "bg-white border-2 rounded-[16px] p-[24px] flex flex-col gap-[20px] relative transition-all shadow-sm overflow-hidden group",
                isLive
                  ? "border-brand-secondary shadow-md hover:shadow-lg"
                  : "border-brand-border hover:border-brand-secondary/40 hover:shadow-md"
              )}
            >
              <div className="flex flex-col gap-[4px]">
                <h2 className="font-bold text-brand-primary text-[20px] leading-tight">
                  {course.mata_kuliah.kode_mk} - {course.mata_kuliah.nama_mk}
                </h2>
                <div className="flex items-center gap-[6px] text-brand-text-dim text-[13px] font-semibold">
                  <Users size={16} />
                  <span>{course.enrolled} Students Enrolled</span>
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
                <div className="flex items-center gap-[6px]">
                  <MapPin size={16} />
                  <span>{course.ruangan ?? "TBD"}</span>
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
      </div>
    </div>
  );
}
