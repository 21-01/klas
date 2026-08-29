import { useLoaderData } from "react-router";
import TopAppBar from "~/components/TopAppBar";
import ClassCard from "~/components/ClassCard";
import { api } from "~/lib/api";
import type { Route } from "./+types/dashboard";

export function meta() {
  return [
    { title: "Klas. - Mahasiswa Dashboard" },
    { name: "description", content: "Student Dashboard for Klas." },
  ];
}

export async function clientLoader({}: Route.ClientLoaderArgs) {
  const data = await api.getMyDashboard();
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long", day: "numeric", month: "short",
  });
  return { date: dateStr, classes: data.classes };
}

export default function Dashboard() {
  const { date, classes } = useLoaderData<typeof clientLoader>();

  return (
    <div className="bg-brand-bg min-h-full flex flex-col items-start relative w-full text-brand-text">
      <TopAppBar />

      <div className="flex flex-col gap-[32px] items-start pb-[96px] pt-[32px] px-[24px] w-full">
        <div className="flex flex-col gap-[3px] items-start w-full">
          <span className="font-semibold text-brand-text-muted text-[11px] tracking-[0.6px] uppercase">
            {date}
          </span>
          <h1 className="font-bold text-[24px] tracking-[-0.24px] text-brand-text">
            Today's Active Class
          </h1>
        </div>

        <div className="flex flex-col gap-[16px] w-full">
          {classes.length === 0 && (
            <p className="text-brand-text-dim text-[13px] text-center py-8">
              No classes scheduled for today.
            </p>
          )}
          {classes.map((c) => {
            const variant = c.sesi_status === "live"
              ? "in-session" as const
              : c.sesi_status === "completed"
                ? "closed" as const
                : "upcoming" as const;
            return (
              <ClassCard
                key={c.jadwal_id}
                variant={variant}
                time={`${c.waktu_mulai} - ${c.waktu_selesai}`}
                title={c.mata_kuliah.nama_mk}
                location={c.ruangan ?? "TBD"}
                lecturer={undefined}
                action={c.sesi_id ? { label: "SCAN QR", to: "/mahasiswa/scanner" } : undefined}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
