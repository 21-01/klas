import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { MapPin, Users, Clock, History, ExternalLink, Loader2, FileText, Calendar } from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/lib/api";

export function meta() {
  return [
    { title: "Lecturer Dashboard - Klas." },
  ];
}

export default function DosenDashboard() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    api.getDosenDashboard()
      .then((data) => setCourses(data.courses))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
      
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleGoToClass = (jadwal_id: string) => {
    navigate(`/dosen/attendance/${jadwal_id}`);
  };

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
          <span className="font-semibold text-brand-text-dim text-[12px] tracking-[1.2px] uppercase">
            PORTAL OVERVIEW
          </span>
          <h1 className="font-bold text-brand-primary text-[32px] tracking-[-0.64px] leading-tight">
            Class Session Management
          </h1>
        </div>

        <div className="flex gap-[12px] items-center shrink-0">
          <div className="flex flex-col items-end mr-2">
            <span className="text-[10px] font-bold text-brand-text-dim uppercase tracking-[1px]">
              {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <span className="text-[14px] font-bold text-brand-primary font-mono tabular-nums tracking-tight">
              {currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <Link
            to="/dosen/report"
            className="bg-brand-surface border border-brand-border hover:bg-slate-100 text-brand-text font-bold text-[13px] tracking-[0.6px] px-[20px] py-[10px] rounded-[10px] transition-all flex items-center gap-[8px]"
          >
            <History size={16} />
            <span>History</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[24px] w-full">
        {courses.map((course) => {
          const isLive = course.latest_session?.status === "live";
          return (
            <div key={course.jadwal_id} className={cn(
              "bg-white border-2 rounded-[16px] p-[24px] flex flex-col gap-[20px] relative transition-all shadow-sm overflow-hidden",
              isLive ? "border-brand-secondary shadow-md" : "border-brand-border"
            )}>
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

              <div className="flex flex-col gap-[16px] flex-1">
                <div className="flex gap-[16px] items-center text-brand-text-dim text-[13px] font-semibold">
                  <div className="flex items-center gap-[6px]">
                    <Clock size={16} />
                    <span>{course.hari ? course.hari.substring(0, 3) + ", " : ""}{course.waktu_mulai?.substring(0, 5)}-{course.waktu_selesai?.substring(0, 5)}</span>
                  </div>
                  <div className="flex items-center gap-[6px]">
                    <MapPin size={16} />
                    <span>{course.ruangan ?? "TBD"}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[12px] text-brand-text-dim font-semibold">Session Status</span>
                    <span className={cn(
                      "font-bold text-[14px]",
                      isLive ? "text-brand-secondary" : "text-brand-text-dim"
                    )}>
                      {isLive ? "Open Live Attendance" : course.latest_session ? "Closed" : "Not Started"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-[8px]">
                {!isLive ? (
                  <button
                    onClick={() => handleGoToClass(course.jadwal_id)}
                    className="flex-1 bg-brand-secondary hover:bg-brand-primary text-white text-center font-bold text-[13px] py-[12px] rounded-[10px] transition-all shadow-md cursor-pointer"
                  >
                    Open Session
                  </button>
                ) : (
                  <Link
                    to={`/dosen/attendance/${course.jadwal_id}`}
                    className="flex-1 bg-brand-secondary hover:bg-brand-primary text-white text-center font-bold text-[13px] py-[12px] rounded-[10px] transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <span>Go to Live Monitor</span>
                    <ExternalLink size={16} />
                  </Link>
                )}
                <Link
                  to={`/dosen/attendance/correction/${course.jadwal_id}`}
                  className="border border-brand-border hover:bg-slate-50 text-brand-primary text-center font-bold text-[13px] py-[12px] rounded-[10px] transition-all px-4"
                >
                  <FileText size={16} />
                </Link>
                <Link
                  to={`/dosen/attendance/${course.jadwal_id}/sessions`}
                  className="border border-brand-border hover:bg-slate-50 text-brand-primary text-center font-bold text-[13px] py-[12px] rounded-[10px] transition-all px-4"
                >
                  <Calendar size={16} />
                </Link>
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
}
