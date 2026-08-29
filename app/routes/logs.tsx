import { useLoaderData } from "react-router";
import { cn } from "~/lib/utils";
import TopAppBar from "~/components/TopAppBar";
import { api } from "~/lib/api";
import type { Route } from "./+types/logs";

export function meta() {
  return [
    { title: "Logs - Klas." },
  ];
}

export async function clientLoader({}: Route.ClientLoaderArgs) {
  const data = await api.getMyLogs({ limit: 50 });
  const stats = await api.getAttendanceStats();
  return {
    logs: data.logs,
    attendance: `${stats.attendance_rate}%`,
    semester: stats.semester ? `${stats.semester}` : "Current Semester",
  };
}

export default function ClassLogs() {
  const { logs, attendance, semester } = useLoaderData<typeof clientLoader>();

  return (
    <div className="bg-brand-bg min-h-full flex flex-col items-start w-full text-brand-text">
      <TopAppBar />

      <div className="flex flex-col gap-[24px] items-start pb-[128px] pt-[32px] px-[24px] w-full">

        <div className="flex flex-col gap-[4px] items-start w-full">
          <span className="font-semibold text-brand-text-dim text-[12px] tracking-[1.2px] uppercase">
            ACADEMIC STANDING
          </span>
          <h2 className="font-extrabold text-[24px] tracking-[-0.24px] text-brand-secondary">
            Total Attendance: {attendance}
          </h2>
          <div className="bg-brand-secondary h-[4px] w-[96px] mt-1" />
        </div>

        <div className="flex items-end justify-between w-full pt-[20px]">
          <h3 className="font-semibold text-brand-text text-[18px]">
            Class Logs
          </h3>
          <span className="font-semibold text-brand-text-dim text-[12px] tracking-[0.6px]">
            {semester}
          </span>
        </div>

        <div className="flex flex-col gap-[8px] w-full">
          {logs.length === 0 && (
            <p className="text-brand-text-dim text-[13px] text-center py-8">
              No attendance records found.
            </p>
          )}
          {logs.map((log) => {
            const isPresent = log.status === "present";
            return (
              <div key={log.presensi_id} className="bg-brand-surface flex items-center justify-between p-[16px] w-full rounded-lg">
                <div className="flex flex-col items-start gap-[2px] mr-2 min-w-0 flex-1">
                  <h4 className="font-semibold text-brand-text text-[16px] leading-snug truncate w-full">
                    {log.sesi_kehadiran.jadwal_kelas.mata_kuliah.nama_mk}
                  </h4>
                  <span className="text-brand-text-dim text-[12px] truncate w-full">
                    {new Date(log.waktu_check_in).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="bg-[rgba(255,255,255,0.5)] border border-brand-border flex items-center justify-center py-[6px] px-[16px] rounded-md shrink-0">
                  <span className={cn(
                    "font-semibold text-[12px] tracking-[0.6px]",
                    isPresent ? "text-emerald-700" : "text-status-error"
                  )}>
                    {log.status === "present" ? "Present" : log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <button className="border border-brand-secondary active:scale-[0.98] transition-transform flex items-center justify-center py-[17px] w-full rounded mt-4 cursor-pointer">
          <span className="font-semibold text-brand-secondary text-[12px] tracking-[1.2px] uppercase">
            DOWNLOAD FULL REPORT
          </span>
        </button>
      </div>
    </div>
  );
}
